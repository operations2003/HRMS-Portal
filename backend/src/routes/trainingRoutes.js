import { Router } from 'express';
import { trainingController } from '../controllers/trainingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// Courses
router.get('/courses', authorize(['training:read', 'employee:read']), trainingController.listCourses);
router.post('/courses', authorize(['training:write', 'HR', 'Admin', 'SuperAdmin']), trainingController.createCourse);

// Enrollments
router.get('/enrollments', authorize(['training:read', 'employee:read']), trainingController.listEnrollments);
router.post('/enrollments', authorize(['training:read', 'training:write', 'employee:read']), trainingController.enroll);
router.post('/courses/:id/enroll', authorize(['training:read', 'training:write', 'employee:read']), (req, res, next) => {
  req.body.courseId = req.params.id;
  return trainingController.enroll(req, res, next);
});
router.patch('/enrollments/:id', authorize(['training:read', 'training:write', 'employee:read']), trainingController.updateProgress);

// Skills
router.get('/skills', authorize(['training:read', 'employee:read']), trainingController.getSkillMatrix);
router.post('/skills', authorize(['training:write', 'employee:read']), trainingController.upsertSkill);

export default router;
