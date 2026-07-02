import { createSwaggerSpec } from 'next-swagger-doc';
import fs from 'fs';

const spec = createSwaggerSpec({
    apis: [
        './src/app/api/**/*.js',
        './prisma/openapi/openapi.js'
    ],
    definition: {
        openapi: '3.0.0',
        info: { title: 'SportsDeck API Docs', version: '1.0.0' },
    },
});


fs.writeFileSync('collection.openapi', JSON.stringify(spec, null, 2));
console.log('Done!');
