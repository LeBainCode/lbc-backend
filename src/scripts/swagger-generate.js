const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Le Bain Code API',
      version: '1.0.0',
      description: 'API documentation for the Le Bain Code platform',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'https://lebaincode-backend.onrender.com' : 'http://localhost:5000',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);
fs.writeFileSync(
  path.resolve(__dirname, '../public/swagger.json'),
  JSON.stringify(specs, null, 2)
);

console.log('Swagger documentation generated successfully');
