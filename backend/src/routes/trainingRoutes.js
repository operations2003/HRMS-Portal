import { Router } from 'express';
import { trainingController } from '../controllers/trainingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeTrainingManager } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// Courses
// View courses (staff see published, Training Managers see all)
router.get('/courses', trainingController.listCourses);
router.get('/courses/:id', trainingController.getCourseById);

// Training Management Actions (Admin OR HR whose Department is Learning & Development)
router.post('/courses', authorizeTrainingManager, trainingController.createCourse);
router.put('/courses/:id', authorizeTrainingManager, trainingController.updateCourse);
router.patch('/courses/:id/publish', authorizeTrainingManager, trainingController.publishCourse);
router.patch('/courses/:id/unpublish', authorizeTrainingManager, trainingController.unpublishCourse);
router.delete('/courses/:id', authorizeTrainingManager, trainingController.deleteCourse);
router.get('/courses/:id/progress', authorizeTrainingManager, trainingController.getCourseCompletionMatrix);

// Enrollments
// Training Managers see all progress data; other staff only see their own enrollments
router.get('/enrollments', trainingController.listEnrollments);
router.post('/enrollments', trainingController.enroll);
router.post('/courses/:id/enroll', (req, res, next) => {
  req.body.courseId = req.params.id;
  return trainingController.enroll(req, res, next);
});
router.patch('/enrollments/:id', trainingController.updateProgress);

// Skills
router.get('/skills', trainingController.getSkillMatrix);
router.post('/skills', trainingController.upsertSkill);

export default router;
