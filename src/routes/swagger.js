// src/routes/swagger.js
const express = require('express');
const router = express.Router();
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('path'); // Required for path handling

// Set up Swagger options including global API info and security components.
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Le Bain Code API',
      version: '1.0.0',
      description: 'Official API documentation for the Le Bain Code platform',
      contact: {
        name: 'Le Bain Code',
        url: 'https://www.lebaincode.com',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production'
          ? 'https://lebaincode-backend.onrender.com'
          : `http://localhost:${process.env.PORT || 5000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: []
    }],
  },
  // These files should include your JSDoc Swagger comments.
  apis: [
    './src/routes/schemas.js',
    './src/routes/lbcSwagger.js', 
    './src/routes/email.js',
    './src/routes/auth.js',
    './src/routes/admin.js',
    './src/routes/analytics.js',
    './src/routes/modules.js',
    './src/routes/beta.js',
    './src/routes/dashboard.js',
    './src/routes/security.js',
    'src/routes/prospectConversions.js',
    'src/models/ProspectConversion.js',
    'src/routes/debugLogs.js',
    'src/models/EmailEvents.js',
    'src/routes/emailNotifications.js',
  ],
};

// Generate the Swagger specification
const specs = swaggerJsdoc(swaggerOptions);

// Add an endpoint to download the raw JSON specification
router.get('/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="swagger.json"');
  res.send(specs);
});

// Serve the Swagger UI documentation at /api-docs
router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
    },
  })
);

module.exports = router;
