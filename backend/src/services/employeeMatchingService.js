import { pool } from '../config/db.js';
import { nanoid } from 'nanoid';

/**
 * Employee Matching Service
 * Matches roster employee names to HRMS employee records
 * Supports fuzzy matching and ambiguity resolution
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
        d.title as designation_title
      FROM employees e
      LEFT JOIN designations d ON e.desig_id = d.id
      WHERE e.org_id = $1 AND e.status = 'Active'
      ORDER BY e.last_name, e.first_name`,
      [orgId]
    );

    const hrmsEmployees = employeesResult.rows.map(emp => ({
      ...emp,
      fullName: `${emp.first_name} ${emp.last_name}`.trim(),
      searchName: this.normalizeForMatching(`${emp.first_name} ${emp.last_name}`)
    }));

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
        matchConfidence: matchResult.confidence,
        matchMethod: matchResult.method,
        isAmbiguous: matchResult.isAmbiguous,
        alternativeMatches: matchResult.alternatives || [],
        rosterEmployee: rosterEmp
      };

      mappings.push(mapping);

      if (matchResult.employee) {
        if (matchResult.isAmbiguous) {
          ambiguous.push(mapping);
        } else {
          matched.push(mapping);
        }
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
      hrmsEmployees
    };
  }

  /**
   * Find best matching HRMS employee for roster employee
   */
  findBestMatch(rosterEmployee, hrmsEmployees) {
    const rosterName = this.normalizeForMatching(rosterEmployee.rosterEmployeeName);
    const rosterDesignation = this.normalizeForMatching(rosterEmployee.designation || '');

    const candidates = [];

    for (const hrmsEmp of hrmsEmployees) {
      const nameScore = this.calculateNameSimilarity(rosterName, hrmsEmp.searchName);
      const designationScore = rosterDesignation && hrmsEmp.designation_title
        ? this.calculateSimilarity(rosterDesignation, this.normalizeForMatching(hrmsEmp.designation_title))
        : 0;

      // Combined score: name is weighted more heavily (70%) vs designation (30%)
      const combinedScore = (nameScore * 0.7) + (designationScore * 0.3);

      if (nameScore >= 0.7) { // Only consider if name similarity is decent
        candidates.push({
          employee: hrmsEmp,
          nameScore,
          designationScore,
          combinedScore
        });
      }
    }

    // Sort by combined score descending
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

    // Exact match (confidence >= 0.98)
    if (best.nameScore >= 0.98) {
      return {
        employee: best.employee,
        confidence: best.combinedScore,
        method: 'EXACT',
        isAmbiguous: false,
        alternatives: candidates.slice(1, 3).map(c => ({
          employeeId: c.employee.id,
          fullName: c.employee.fullName,
          designation: c.employee.designation_title,
          confidence: c.combinedScore
        }))
      };
    }

    // Check for ambiguity: multiple candidates with similar scores
    const secondBest = candidates[1];
    const isAmbiguous = secondBest && (best.combinedScore - secondBest.combinedScore) < 0.1;

    return {
      employee: best.employee,
      confidence: best.combinedScore,
      method: isAmbiguous ? 'AMBIGUOUS' : 'FUZZY',
      isAmbiguous,
      alternatives: candidates.slice(1, 4).map(c => ({
        employeeId: c.employee.id,
        fullName: c.employee.fullName,
        designation: c.employee.designation_title,
        confidence: c.combinedScore
      }))
    };
  }

  /**
   * Calculate name similarity with special handling for common patterns
   */
  calculateNameSimilarity(name1, name2) {
    if (name1 === name2) return 1.0;

    // Try different name orderings (first last vs last first)
    const parts1 = name1.split(/\s+/).filter(p => p.length > 0);
    const parts2 = name2.split(/\s+/).filter(p => p.length > 0);

    if (parts1.length === 0 || parts2.length === 0) return 0;

    // Direct comparison
    const directScore = this.calculateSimilarity(name1, name2);

    // Try reversed name order
    let reversedScore = 0;
    if (parts1.length >= 2 && parts2.length >= 2) {
      const reversed1 = [...parts1].reverse().join(' ');
      const reversed2 = [...parts2].reverse().join(' ');
      reversedScore = Math.max(
        this.calculateSimilarity(reversed1, name2),
        this.calculateSimilarity(name1, reversed2)
      );
    }

    // Try partial matches (initials + last name, etc.)
    let partialScore = 0;
    if (parts1.length > 1 && parts2.length > 1) {
      const lastName1 = parts1[parts1.length - 1];
      const lastName2 = parts2[parts2.length - 1];
      if (lastName1 === lastName2) {
        partialScore = 0.7 + (this.calculateSimilarity(parts1[0], parts2[0]) * 0.3);
      }
    }

    return Math.max(directScore, reversedScore, partialScore);
  }

  /**
   * Calculate Levenshtein-based similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Normalize name for matching (lowercase, trim, remove extra spaces)
   */
  normalizeForMatching(name) {
    return String(name || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, ''); // Remove special characters
  }

  /**
   * Manually resolve ambiguous mapping
   */
  async resolveMapping(mappingId, selectedEmployeeId, resolvedBy) {
    // This would update the mapping in database
    // For now, return the resolution
    return {
      mappingId,
      matchedEmployeeId: selectedEmployeeId,
      matchMethod: 'MANUAL',
      isAmbiguous: false,
      resolvedBy,
      resolvedAt: new Date().toISOString()
    };
  }
}

export default new EmployeeMatchingService();
