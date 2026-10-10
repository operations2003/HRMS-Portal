import { pool } from '../config/db.js';
import { nanoid } from 'nanoid';

/**
 * Employee Matching Service
 * Matches roster employee names to HRMS employee records
 * Supports normalized name matching, fuzzy matching, and ambiguity resolution
 */
class EmployeeMatchingService {
  /**
   * Match roster employees to HRMS employees
   * @param {Array} rosterEmployees - Parsed roster employees
   * @param {String} orgId - Organization ID
   * @returns {Object} Matching results with mappings
   */
  async matchEmployees(rosterEmployees, orgId) {
    // Fetch all active employees for the organization
    const employeesResult = await pool.query(
      `SELECT 
        e.id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        d.title as designation_title,
        dep.name as department_name
      FROM employees e
      LEFT JOIN designations d ON e.desig_id = d.id
      LEFT JOIN departments dep ON e.dept_id = dep.id
      WHERE e.org_id = $1 AND e.status = 'Active'
      ORDER BY e.last_name, e.first_name`,
      [orgId]
    );

    const hrmsEmployees = employeesResult.rows.map((emp) => {
      const first = (emp.first_name || '').trim();
      const last = (emp.last_name || '').trim();
      const fullName = `${first} ${last}`.trim();
      return {
        ...emp,
        fullName,
        normalizedFullName: this.normalizeForMatching(fullName),
        normalizedInvertedName: this.normalizeForMatching(`${last} ${first}`),
        normalizedCode: this.normalizeForMatching(emp.employee_code || '')
      };
    });

    const mappings = [];
    const matched = [];
    const unmatched = [];
    const ambiguous = [];

    for (const rosterEmp of rosterEmployees) {
      const matchResult = this.findBestMatch(rosterEmp, hrmsEmployees);

      const mapping = {
        id: nanoid(),
        rosterEmployeeName: rosterEmp.rosterEmployeeName,
        rosterDesignation: rosterEmp.designation,
        matchedEmployeeId: matchResult.employee?.id || null,
        matchedEmployeeName: matchResult.employee?.fullName || null,
        matchedEmployeeCode: matchResult.employee?.employee_code || null,
        matchConfidence: parseFloat(matchResult.confidence.toFixed(2)),
        matchMethod: matchResult.method,
        isAmbiguous: matchResult.isAmbiguous,
        alternativeMatches: matchResult.alternatives || [],
        rosterEmployee: rosterEmp
      };

      mappings.push(mapping);

      if (matchResult.isAmbiguous) {
        ambiguous.push(mapping);
      } else if (matchResult.employee) {
        matched.push(mapping);
      } else {
        unmatched.push(mapping);
      }
    }

    return {
      totalRosterEmployees: rosterEmployees.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      ambiguousCount: ambiguous.length,
      mappings,
      matched,
      unmatched,
      ambiguous,
      hrmsEmployees: hrmsEmployees.map(e => ({
        id: e.id,
        employeeCode: e.employee_code,
        fullName: e.fullName,
        designation: e.designation_title,
        department: e.department_name
      }))
    };
  }

  /**
   * Find best matching HRMS employee for roster employee
   */
  findBestMatch(rosterEmployee, hrmsEmployees) {
    const rawRosterName = rosterEmployee.rosterEmployeeName || '';
    const rosterName = this.normalizeForMatching(rawRosterName);
    const rosterDesignation = this.normalizeForMatching(rosterEmployee.designation || '');

    // Check if name contains an employee code like (EMP001) or TNK-123
    const codeMatch = rawRosterName.match(/\(([A-Za-z0-9_-]+)\)/);
    if (codeMatch) {
      const extractedCode = this.normalizeForMatching(codeMatch[1]);
      const exactCodeEmp = hrmsEmployees.find(e => e.normalizedCode === extractedCode);
      if (exactCodeEmp) {
        return {
          employee: exactCodeEmp,
          confidence: 1.0,
          method: 'EXACT_ID',
          isAmbiguous: false,
          alternatives: []
        };
      }
    }

    // Direct exact name match
    const exactMatches = hrmsEmployees.filter(
      e => e.normalizedFullName === rosterName || e.normalizedInvertedName === rosterName
    );

    if (exactMatches.length === 1) {
      return {
        employee: exactMatches[0],
        confidence: 1.0,
        method: 'EXACT',
        isAmbiguous: false,
        alternatives: []
      };
    } else if (exactMatches.length > 1) {
      // Multiple employees with the EXACT identical name: ambiguous!
      return {
        employee: exactMatches[0],
        confidence: 0.9,
        method: 'AMBIGUOUS',
        isAmbiguous: true,
        alternatives: exactMatches.map(c => ({
          employeeId: c.id,
          employeeCode: c.employee_code,
          fullName: c.fullName,
          designation: c.designation_title,
          department: c.department_name,
          confidence: 0.9
        }))
      };
    }

    // Similarity scoring across all active employees
    const candidates = [];

    for (const hrmsEmp of hrmsEmployees) {
      const nameScoreDirect = this.calculateSimilarity(rosterName, hrmsEmp.normalizedFullName);
      const nameScoreInverted = this.calculateSimilarity(rosterName, hrmsEmp.normalizedInvertedName);
      const nameScore = Math.max(nameScoreDirect, nameScoreInverted);

      const designationScore = rosterDesignation && hrmsEmp.designation_title
        ? this.calculateSimilarity(rosterDesignation, this.normalizeForMatching(hrmsEmp.designation_title))
        : 0;

      // Primary weight on name (85%), slight consideration for designation (15%) for ranking only
      const combinedScore = (nameScore * 0.85) + (designationScore * 0.15);

      if (nameScore >= 0.70) {
        candidates.push({
          employee: hrmsEmp,
          nameScore,
          designationScore,
          combinedScore
        });
      }
    }

    candidates.sort((a, b) => b.combinedScore - a.combinedScore);

    if (candidates.length === 0) {
      return {
        employee: null,
        confidence: 0,
        method: 'UNMATCHED',
        isAmbiguous: false,
        alternatives: []
      };
    }

    const best = candidates[0];
    const second = candidates[1];

    // Check for ambiguity: multiple candidates with close scores
    const isAmbiguous = second && (
      (best.combinedScore - second.combinedScore) < 0.12 ||
      (best.nameScore >= 0.80 && second.nameScore >= 0.80)
    );

    if (isAmbiguous) {
      return {
        employee: null, // Require manual resolution
        confidence: best.combinedScore,
        method: 'AMBIGUOUS',
        isAmbiguous: true,
        alternatives: candidates.slice(0, 4).map(c => ({
          employeeId: c.employee.id,
          employeeCode: c.employee.employee_code,
          fullName: c.employee.fullName,
          designation: c.employee.designation_title,
          department: c.employee.department_name,
          confidence: parseFloat(c.combinedScore.toFixed(2))
        }))
      };
    }

    // Single decent match
    if (best.nameScore >= 0.75) {
      return {
        employee: best.employee,
        confidence: best.combinedScore,
        method: 'FUZZY',
        isAmbiguous: false,
        alternatives: candidates.slice(1, 3).map(c => ({
          employeeId: c.employee.id,
          employeeCode: c.employee.employee_code,
          fullName: c.employee.fullName,
          designation: c.employee.designation_title,
          confidence: parseFloat(c.combinedScore.toFixed(2))
        }))
      };
    }

    return {
      employee: null,
      confidence: best.combinedScore,
      method: 'UNMATCHED',
      isAmbiguous: false,
      alternatives: candidates.slice(0, 3).map(c => ({
        employeeId: c.employee.id,
        employeeCode: c.employee.employee_code,
        fullName: c.employee.fullName,
        designation: c.employee.designation_title,
        confidence: parseFloat(c.combinedScore.toFixed(2))
      }))
    };
  }

  /**
   * Calculate string similarity (0 to 1) using Levenshtein distance & token overlap
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const tokens1 = str1.split(' ').filter(Boolean);
    const tokens2 = str2.split(' ').filter(Boolean);

    // Token set overlap
    const intersection = tokens1.filter(t => tokens2.includes(t));
    const tokenScore = (2 * intersection.length) / (tokens1.length + tokens2.length);

    // Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    const editScore = 1 - (distance / maxLength);

    return Math.max(tokenScore, editScore);
  }

  /**
   * Levenshtein distance algorithm
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  /**
   * Normalize name: lowercase, trim, remove honorary titles (Mr, Ms, Mrs, Dr, Shri, etc.)
   */
  normalizeForMatching(name) {
    if (!name) return '';
    return String(name)
      .toLowerCase()
      .trim()
      .replace(/^(mr|mrs|ms|dr|er|shri|smt)\.?\s+/i, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export default new EmployeeMatchingService();
