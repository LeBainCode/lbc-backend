// routes/modules.js
const express = require('express');
const router = express.Router();

// Import models and middleware
const Module = require('../models/Module');
const ModuleDay = require('../models/ModuleDay');
const { ModuleTest, TestSubmission } = require('../models/ModuleTest');
const verifyToken = require('../middleware/verifyToken');
const { betaContentRestriction } = require('../middleware/betaContentRestriction');

/**
 * @swagger
 * tags:
 *   name: Modules
 *   description: Module management and progression endpoints
 */

/**
 * @swagger
 * /api/modules:
 *   get:
 *     summary: Retrieve a list of all available modules
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: An array of modules.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Module'
 *       401:
 *         description: Unauthorized access.
 *       500:
 *         description: Server error.
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const modules = await Module.find().sort({ order: 1 });
    res.status(200).json(modules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/modules/{id}:
 *   get:
 *     summary: Retrieve details of a specific module by its ID
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         description: The module ID.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Module data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Module'
 *       404:
 *         description: Module not found.
 *       500:
 *         description: Server error.
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const moduleId = req.params.id;
    const moduleData = await Module.findById(moduleId);
    if (!moduleData) {
      return res.status(404).json({ message: 'Module not found' });
    }
    res.status(200).json(moduleData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/modules/{moduleId}/days:
 *   get:
 *     summary: Retrieve all days for a specific module
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         description: The module ID whose days you want to retrieve.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: An array of module days.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ModuleDay'
 *       404:
 *         description: Module days not found.
 *       500:
 *         description: Server error.
 */
router.get('/:moduleId/days', verifyToken, async (req, res) => {
  try {
    const moduleId = req.params.moduleId;
    const days = await ModuleDay.find({ moduleId }).sort({ dayNumber: 1 });
    if (!days || days.length === 0) {
      return res.status(404).json({ message: 'No days found for this module' });
    }
    res.status(200).json(days);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/modules/{moduleId}/days/{dayNumber}:
 *   get:
 *     summary: Retrieve details for a specific day within a module.
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleId
 *         description: The module ID.
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: dayNumber
 *         description: The day number within the module.
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Data for the specified module day.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleDay'
 *       404:
 *         description: Module day not found.
 *       500:
 *         description: Server error.
 */
router.get('/:moduleId/days/:dayNumber', verifyToken, betaContentRestriction, async (req, res) => {
  try {
    const { moduleId, dayNumber } = req.params;
    const day = await ModuleDay.findOne({ moduleId, dayNumber: parseInt(dayNumber) });
    if (!day) return res.status(404).json({ message: 'Module day not found' });
    res.status(200).json(day);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/modules/{moduleSlug}/test:
 *   get:
 *     summary: Retrieve the test associated with a module.
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleSlug
 *         description: The slug identifier for the module.
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The test questions (with sanitized answer options).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModuleTest'
 *       403:
 *         description: Test not accessible because prerequisites have not been met.
 *       404:
 *         description: Test not found.
 *       500:
 *         description: Server error.
 */
router.get('/:moduleSlug/test', verifyToken, async (req, res) => {
  try {
    const moduleSlug = req.params.moduleSlug;
    // Find the module based on its slug
    const moduleData = await Module.findOne({ slug: moduleSlug });
    if (!moduleData) return res.status(404).json({ message: 'Module not found' });
    
    // Retrieve the associated test
    const moduleTest = await ModuleTest.findOne({ moduleId: moduleData._id });
    if (!moduleTest) return res.status(404).json({ message: 'Test not found for this module' });
    
    // Remove correct answer flags before sending data to client
    const sanitizedQuestions = moduleTest.questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options.map(o => ({
        _id: o._id,
        text: o.text
      })),
      type: q.type,
      points: q.points
    }));
    
    const sanitizedTest = {
      _id: moduleTest._id,
      moduleId: moduleTest.moduleId,
      title: moduleTest.title,
      description: moduleTest.description,
      timeLimit: moduleTest.timeLimit,
      passingScore: moduleTest.passingScore,
      questions: sanitizedQuestions,
      createdAt: moduleTest.createdAt,
      updatedAt: moduleTest.updatedAt
    };
    
    res.status(200).json(sanitizedTest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/modules/{moduleSlug}/test/submit:
 *   post:
 *     summary: Submit test answers for a module and receive a score.
 *     tags: [Modules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: moduleSlug
 *         description: The slug identifier for the module test.
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       description: Submit answers as an array of objects.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     selectedOptionId:
 *                       type: string
 *                     codingAnswer:
 *                       type: string
 *     responses:
 *       200:
 *         description: Test submitted with computed score and pass/fail status.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 score:
 *                   type: number
 *                 passed:
 *                   type: boolean
 *       400:
 *         description: Invalid submission data.
 *       500:
 *         description: Server error.
 */
router.post('/:moduleSlug/test/submit', verifyToken, async (req, res) => {
  try {
    const moduleSlug = req.params.moduleSlug;
    const { answers } = req.body;
    
    // Find module based on slug.
    const moduleData = await Module.findOne({ slug: moduleSlug });
    if (!moduleData) return res.status(404).json({ message: 'Module not found' });
    
    const moduleTest = await ModuleTest.findOne({ moduleId: moduleData._id });
    if (!moduleTest) return res.status(404).json({ message: 'Test not found for this module' });
    
    // Calculate the test score.
    let totalPoints = 0, earnedPoints = 0;
    moduleTest.questions.forEach(question => {
      totalPoints += question.points;
      const userAnswer = answers.find(ans => ans.questionId === question._id.toString());
      if (userAnswer) {
        const correctOption = question.options.find(opt => opt.isCorrect);
        if (userAnswer.selectedOptionId === correctOption?._id.toString()) {
          earnedPoints += question.points;
        }
      }
    });
    
    const scorePercentage = Math.round((earnedPoints / totalPoints) * 100);
    const passed = scorePercentage >= moduleTest.passingScore;
    
    // Record test submission (this can be enhanced to update user progress as needed)
    await TestSubmission.create({
      userId: req.user._id,
      moduleTestId: moduleTest._id,
      answers,
      score: scorePercentage,
      passed,
      completedAt: new Date()
    });
    
    res.status(200).json({ score: scorePercentage, passed });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
