// src/scripts/seedModules.js
// Load environment variables directly
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const path = require('path');

console.log('Connecting to database...');

// Use the MongoDB URI directly from your .env file
const MONGODB_URI = "mongodb+srv://bayanmedou:c48z3w7zUp2Sde2H@cluster0.zx83z.mongodb.net/lebaincode?retryWrites=true&w=majority";

// Import models directly - this avoids path issues
let Module, ModuleDay, ModuleTest;

async function seedModules() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MongoDB URI not provided');
    }
    
    console.log('Using MongoDB URI:', MONGODB_URI.replace(/(mongodb\+srv:\/\/)[^:]+:[^@]+@/, '$1****:****@'));
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Import models only after connecting to MongoDB
    console.log('Importing models...');
    Module = mongoose.model('Module', new mongoose.Schema({
      name: { type: String, required: true, unique: true },
      slug: { type: String, required: true, unique: true },
      description: { type: String, required: true },
      order: { type: Number, required: true },
      isPaid: { type: Boolean, default: false },
      prerequisiteModule: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null },
      prerequisiteScore: { type: Number, default: 60 },
      notions: [{ type: String, trim: true }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }));
    
    ModuleDay = mongoose.model('ModuleDay', new mongoose.Schema({
      moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
      dayNumber: { type: Number, required: true, min: 1 },
      title: { type: String, required: true },
      description: { type: String, required: true },
      exercises: [{
        title: { type: String, required: true },
        description: { type: String, required: true },
        content: { type: String, required: true },
        order: { type: Number, required: true }
      }],
      notions: [{ type: String, trim: true }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }));
    
    ModuleTest = mongoose.model('ModuleTest', new mongoose.Schema({
      moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
      title: { type: String, required: true },
      description: { type: String, required: true },
      timeLimit: { type: Number, default: 30 },
      passingScore: { type: Number, default: 60 },
      questions: [{
        question: { type: String, required: true },
        options: [{
          text: { type: String, required: true },
          isCorrect: { type: Boolean, required: true }
        }],
        type: { type: String, enum: ['multiple-choice', 'true-false', 'coding'], default: 'multiple-choice' },
        points: { type: Number, default: 1 }
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }));
    
    console.log('Models imported successfully');
    
    // Clear existing modules, days, and tests
    console.log('Clearing existing data...');
    await Module.deleteMany({});
    console.log('- Modules cleared');
    
    await ModuleDay.deleteMany({});
    console.log('- Module days cleared');
    
    await ModuleTest.deleteMany({});
    console.log('- Module tests cleared');
    
    // Create GitHub module (free for all)
    console.log('Creating GitHub module...');
    const githubModule = await Module.create({
      name: 'GitHub Basics',
      slug: 'github',
      description: 'Learn the fundamentals of Git and GitHub for version control and collaboration.',
      order: 1,
      isPaid: false,
      notions: ['git', 'repository', 'commit', 'branch', 'pull request', 'merge']
    });
    
    // Create GitHub days
    for (let i = 1; i <= 7; i++) {
      await ModuleDay.create({
        moduleId: githubModule._id,
        dayNumber: i,
        title: `Day ${i}: ${getGitHubDayTitle(i)}`,
        description: getGitHubDayDescription(i),
        exercises: createGitHubExercises(i),
        notions: getGitHubDayNotions(i)
      });
    }
    
    // Create GitHub test
    await ModuleTest.create({
      moduleId: githubModule._id,
      title: 'GitHub Proficiency Test',
      description: 'Test your knowledge of GitHub fundamentals',
      timeLimit: 30,
      questions: createGitHubTestQuestions()
    });
    console.log('GitHub module created successfully');
    
    // Create Shell module (beta access)
    console.log('Creating Shell module...');
    const shellModule = await Module.create({
      name: 'Shell Commands',
      slug: 'shell',
      description: 'Master command line interfaces with essential shell commands.',
      order: 2,
      isPaid: false,
      prerequisiteModule: githubModule._id,
      prerequisiteScore: 60,
      notions: ['command line', 'terminal', 'bash', 'navigation', 'file manipulation']
    });
    
    // Create Shell days
    for (let i = 1; i <= 5; i++) {
      await ModuleDay.create({
        moduleId: shellModule._id,
        dayNumber: i,
        title: `Day ${i}: ${getShellDayTitle(i)}`,
        description: getShellDayDescription(i),
        exercises: createShellExercises(i),
        notions: getShellDayNotions(i)
      });
    }
    
    // Create Shell test
    await ModuleTest.create({
      moduleId: shellModule._id,
      title: 'Shell Commands Test',
      description: 'Test your knowledge of shell commands',
      timeLimit: 25,
      questions: createShellTestQuestions()
    });
    console.log('Shell module created successfully');
    
    // Create Frontend module (premium)
    console.log('Creating Frontend module...');
    const frontendModule = await Module.create({
      name: 'Frontend Development',
      slug: 'frontend',
      description: 'Learn HTML, CSS, and JavaScript to build modern web interfaces.',
      order: 3,
      isPaid: true,
      prerequisiteModule: shellModule._id,
      prerequisiteScore: 60,
      notions: ['HTML', 'CSS', 'JavaScript', 'DOM', 'responsive design']
    });
    
    // Create Frontend days
    for (let i = 1; i <= 10; i++) {
      await ModuleDay.create({
        moduleId: frontendModule._id,
        dayNumber: i,
        title: `Day ${i}: ${getFrontendDayTitle(i)}`,
        description: getFrontendDayDescription(i),
        exercises: createFrontendExercises(i),
        notions: getFrontendDayNotions(i)
      });
    }
    
    // Create Frontend test
    await ModuleTest.create({
      moduleId: frontendModule._id,
      title: 'Frontend Development Test',
      description: 'Test your knowledge of frontend web development',
      timeLimit: 45,
      questions: createFrontendTestQuestions()
    });
    console.log('Frontend module created successfully');
    
    console.log('Database seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    if (mongoose.connection) {
      await mongoose.disconnect();
      console.log('Database connection closed');
    }
    process.exit(0);
  }
}

// Helper functions
function getGitHubDayTitle(day) {
  const titles = [
    'Introduction to Git & GitHub',
    'Creating Your First Repository',
    'Making Commits',
    'Branching and Merging',
    'Pull Requests',
    'Collaboration Features',
    'Advanced GitHub Workflows'
  ];
  return titles[day - 1] || `GitHub Day ${day}`;
}

function getGitHubDayDescription(day) {
  const descriptions = [
    'Learn the basics of version control and why GitHub is essential for developers.',
    'Set up your first repository and understand the GitHub interface.',
    'Learn how to make commits and track changes in your code.',
    'Master branching strategies and merge your changes effectively.',
    'Create and review pull requests for team collaboration.',
    'Explore GitHub features that enhance team productivity.',
    'Deep dive into advanced GitHub workflows for professional development.'
  ];
  return descriptions[day - 1] || `Description for Day ${day}`;
}

function getGitHubDayNotions(day) {
  const notionsMap = [
    ['version control', 'git basics', 'repositories'],
    ['initialization', 'remote repositories', 'GitHub interface'],
    ['commits', 'staging', 'commit messages'],
    ['branches', 'merging', 'conflict resolution'],
    ['pull requests', 'code reviews', 'approvals'],
    ['issues', 'project boards', 'GitHub actions'],
    ['workflows', 'GitHub CLI', 'integrations']
  ];
  return notionsMap[day - 1] || [];
}

function createGitHubExercises(day) {
  const exercises = [];
  // Number of exercises per day
  const exerciseCount = day === 1 ? 2 : day === 7 ? 4 : 3;
  
  for (let i = 1; i <= exerciseCount; i++) {
    exercises.push({
      title: `Exercise ${day}.${i}: ${getGitHubExerciseTitle(day, i)}`,
      description: getGitHubExerciseDescription(day, i),
      content: getGitHubExerciseContent(day, i),
      order: i
    });
  }
  
  return exercises;
}

function getGitHubExerciseTitle(day, ex) {
  if (day === 1) {
    return ['Installing Git', 'Creating a GitHub Account'][ex - 1] || `GitHub Exercise ${day}.${ex}`;
  }
  return `GitHub Exercise ${day}.${ex}`;
}

function getGitHubExerciseDescription(day, ex) {
  if (day === 1 && ex === 1) {
    return "Install Git on your machine and configure your identity";
  }
  return `Description for GitHub exercise ${day}.${ex}`;
}

function getGitHubExerciseContent(day, ex) {
  if (day === 1 && ex === 1) {
    return "# Installing Git\n\nIn this exercise, you'll install Git on your computer and configure your username and email.\n\n## Instructions\n\n1. Download Git from [git-scm.com](https://git-scm.com/downloads)\n2. Install Git following the installation wizard\n3. Open a terminal or command prompt\n4. Configure your name: `git config --global user.name \"Your Name\"`\n5. Configure your email: `git config --global user.email \"your.email@example.com\"`\n6. Verify your configuration: `git config --list`";
  }
  return `# Content for GitHub exercise ${day}.${ex}\n\n## Instructions\n\nFollow these steps to complete the exercise...\n\n1. Step one\n2. Step two\n3. Step three`;
}

function createGitHubTestQuestions() {
  return [
    {
      question: 'What is Git?',
      options: [
        { text: 'A programming language', isCorrect: false },
        { text: 'A version control system', isCorrect: true },
        { text: 'A code editor', isCorrect: false },
        { text: 'A web hosting service', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'Which command initializes a new Git repository?',
      options: [
        { text: 'git start', isCorrect: false },
        { text: 'git create', isCorrect: false },
        { text: 'git init', isCorrect: true },
        { text: 'git new', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'What is a commit in Git?',
      options: [
        { text: 'A promise to contribute code later', isCorrect: false },
        { text: 'A snapshot of your repository at a specific point in time', isCorrect: true },
        { text: 'A request to merge code', isCorrect: false },
        { text: 'A branch in development', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'Pull requests are used to:',
      options: [
        { text: 'Download updates from a remote repository', isCorrect: false },
        { text: 'Request help from other developers', isCorrect: false },
        { text: 'Propose changes and request a review before merging', isCorrect: true },
        { text: 'Delete a branch', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'What is the purpose of branching in Git?',
      options: [
        { text: 'To develop features, fix bugs, etc. in isolation', isCorrect: true },
        { text: 'To permanently split a project into different versions', isCorrect: false },
        { text: 'To back up the repository', isCorrect: false },
        { text: 'To create a remote copy of the repository', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    }
  ];
}

// Shell module helper functions
function getShellDayTitle(day) {
  const titles = [
    'Introduction to the Command Line',
    'File System Navigation',
    'File Management and Permissions',
    'Text Processing and Pipes',
    'Shell Scripting Basics'
  ];
  return titles[day - 1] || `Shell Day ${day}`;
}

function getShellDayDescription(day) {
  const descriptions = [
    'Learn the fundamentals of command line interfaces and basic shell commands.',
    'Master navigating the file system using command line tools.',
    'Learn to create, copy, move, and set permissions for files and directories.',
    'Process and manipulate text with powerful command line tools.',
    'Create your first shell scripts to automate repetitive tasks.'
  ];
  return descriptions[day - 1] || `Description for Day ${day}`;
}

function getShellDayNotions(day) {
  const notionsMap = [
    ['terminal', 'shell', 'commands', 'options', 'arguments'],
    ['paths', 'navigation', 'pwd', 'cd', 'ls'],
    ['file permissions', 'chmod', 'chown', 'mkdir', 'touch'],
    ['grep', 'sed', 'awk', 'pipes', 'redirection'],
    ['bash scripts', 'variables', 'conditionals', 'loops']
  ];
  return notionsMap[day - 1] || [];
}

function createShellExercises(day) {
  const exercises = [];
  // Number of exercises per day
  const exerciseCount = 3;
  
  for (let i = 1; i <= exerciseCount; i++) {
    exercises.push({
      title: `Exercise ${day}.${i}: Shell Commands`,
      description: `Learn and practice shell commands - Exercise ${day}.${i}`,
      content: `# Shell Exercise ${day}.${i}\n\n## Instructions\n\nFollow these steps to complete the exercise...\n\n1. Step one\n2. Step two\n3. Step three`,
      order: i
    });
  }
  
  return exercises;
}

function createShellTestQuestions() {
  return [
    {
      question: 'Which command is used to change directories?',
      options: [
        { text: 'changedir', isCorrect: false },
        { text: 'cd', isCorrect: true },
        { text: 'chdir', isCorrect: false },
        { text: 'cngd', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'What does the pwd command show?',
      options: [
        { text: 'Password details', isCorrect: false },
        { text: 'Print working directory', isCorrect: true },
        { text: 'Previous working directory', isCorrect: false },
        { text: 'Program with dependencies', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'Which symbol can redirect command output to a file, overwriting existing content?',
      options: [
        { text: '>', isCorrect: true },
        { text: '<', isCorrect: false },
        { text: '>>', isCorrect: false },
        { text: '|', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'What command would you use to view the contents of a file?',
      options: [
        { text: 'show', isCorrect: false },
        { text: 'open', isCorrect: false },
        { text: 'read', isCorrect: false },
        { text: 'cat', isCorrect: true }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'What command would you use to search for a specific pattern in files?',
      options: [
        { text: 'find', isCorrect: false },
        { text: 'search', isCorrect: false },
        { text: 'grep', isCorrect: true },
        { text: 'locate', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    }
  ];
}

// Frontend module helper functions
function getFrontendDayTitle(day) {
  const titles = [
    'HTML Fundamentals',
    'CSS Basics',
    'CSS Layout and Flexbox',
    'Responsive Design',
    'JavaScript Fundamentals',
    'DOM Manipulation',
    'Event Handling',
    'Forms and Validation',
    'API Integration',
    'Building a Complete Frontend Project'
  ];
  return titles[day - 1] || `Frontend Day ${day}`;
}

function getFrontendDayDescription(day) {
  const descriptions = [
    'Learn the fundamental structure of web pages using HTML.',
    'Style your HTML with CSS to create visually appealing pages.',
    'Master modern CSS layout techniques with flexbox.',
    'Make your websites look great on any device.',
    'Learn the basics of JavaScript programming.',
    'Manipulate web page elements using JavaScript.',
    'Handle user interactions with event listeners.',
    'Create and validate user input forms.',
    'Connect your frontend to APIs for dynamic content.',
    'Build a complete web application to showcase your skills.'
  ];
  return descriptions[day - 1] || `Description for Day ${day}`;
}

function getFrontendDayNotions(day) {
  const notionsMap = [
    ['HTML', 'tags', 'elements', 'attributes', 'semantics'],
    ['CSS', 'selectors', 'properties', 'values', 'colors'],
    ['flexbox', 'grid', 'positioning', 'layout'],
    ['media queries', 'viewport', 'mobile-first'],
    ['JavaScript', 'variables', 'data types', 'functions'],
    ['DOM', 'selectors', 'manipulation', 'traversal'],
    ['events', 'event listeners', 'event bubbling'],
    ['form elements', 'validation', 'submission'],
    ['fetch API', 'promises', 'JSON', 'async/await'],
    ['project structure', 'state management', 'best practices']
  ];
  return notionsMap[day - 1] || [];
}

function createFrontendExercises(day) {
  const exercises = [];
  // Number of exercises per day
  const exerciseCount = day === 10 ? 2 : 3;
  
  for (let i = 1; i <= exerciseCount; i++) {
    exercises.push({
      title: `Exercise ${day}.${i}: ${getFrontendExerciseTitle(day, i)}`,
      description: getFrontendExerciseDescription(day, i),
      content: `# Frontend Exercise ${day}.${i}\n\n## Instructions\n\nFollow these steps to complete the exercise...\n\n1. Step one\n2. Step two\n3. Step three`,
      order: i
    });
  }
  
  return exercises;
}

function getFrontendExerciseTitle(day, ex) {
  if (day === 1) {
    return ['Basic HTML Structure', 'Working with Text Elements', 'HTML Lists and Tables'][ex - 1] || `Frontend Exercise ${day}.${ex}`;
  }
  return `Frontend Exercise ${day}.${ex}`;
}

function getFrontendExerciseDescription(day, ex) {
  if (day === 1 && ex === 1) {
    return "Create your first HTML page with proper structure";
  }
  return `Description for Frontend exercise ${day}.${ex}`;
}

function createFrontendTestQuestions() {
  return [
    {
      question: 'Which HTML tag is used to define a paragraph?',
      options: [
        { text: '<paragraph>', isCorrect: false },
        { text: '<p>', isCorrect: true },
        { text: '<para>', isCorrect: false },
        { text: '<pg>', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'In CSS, which property is used to change the text color?',
      options: [
        { text: 'text-color', isCorrect: false },
        { text: 'font-color', isCorrect: false },
        { text: 'color', isCorrect: true },
        { text: 'text-style', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'Which JavaScript method is used to select an element by its id?',
      options: [
        { text: 'document.query()', isCorrect: false },
        { text: 'document.getElementByName()', isCorrect: false },
        { text: 'document.querySelector()', isCorrect: false },
        { text: 'document.getElementById()', isCorrect: true }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'What CSS property would you use to create a flexible layout?',
      options: [
        { text: 'display: flex;', isCorrect: true },
        { text: 'display: flexible;', isCorrect: false },
        { text: 'layout: flex;', isCorrect: false },
        { text: 'position: flex;', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    },
    {
      question: 'Which of the following is NOT a JavaScript data type?',
      options: [
        { text: 'String', isCorrect: false },
        { text: 'Boolean', isCorrect: false },
        { text: 'Character', isCorrect: true },
        { text: 'Number', isCorrect: false }
      ],
      type: 'multiple-choice',
      points: 1
    }
  ];
}

// Execute the seed function
seedModules();
