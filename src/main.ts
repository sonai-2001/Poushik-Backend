import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { resolve } from 'path';

import { AppModule } from './app.module';
import { ApiValidationPipe } from './common/pipes/validation.pipe';
import { CustomExceptionFilter } from './common/filters/exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
    const env = process.env.NODE_ENV || 'development';
    console.info(
        '\x1b[36m%s\x1b[0m',
        '🚀 Bootstrap:',
        `Starting application in [${env.toUpperCase()}] mode`,
    );
    console.info('\x1b[32m%s\x1b[0m', '🔧 Node Version:', process.version);

    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const configService = app.get(ConfigService);
    const logger = app.get(Logger);

    app.enableCors({
        origin: '*',
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
        credentials: true,
    });
    app.use(compression());
    app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));

    app.setGlobalPrefix('/api');
    app.enableVersioning();
    app.useGlobalPipes(new ApiValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new CustomExceptionFilter());

    app.useStaticAssets(resolve('./public'));
    app.setBaseViewsDir(resolve('./views'));

    const createConfig = (title: string, description: string) => {
        return new DocumentBuilder()
            .setOpenAPIVersion('3.1.0')
            .addBearerAuth()
            .setTitle(title)
            .setDescription(description)
            .setVersion('1.0')
            .addTag('Auth')
            .addServer(configService.get('BACKEND_URL'))
            .build();
    };

    const configAdmin = createConfig(
        'Admin panel API',
        'The Admin panel API. <br><br> API endpoints for Frontend application API. <br> <a href="/apidoc/v1/user"> Frontend application API-Doc </a>',
    );
    const configApi = createConfig(
        'Frontend application API',
        'The User API. <br><br> API endpoints for Admin panel API. <br> <a href="/apidoc/v1"> Admin panel API-Doc </a>',
    );

    const documentAdmin = SwaggerModule.createDocument(app, configAdmin);
    const documentApi = SwaggerModule.createDocument(app, configApi);

    // Admin Swagger
    SwaggerModule.setup(
        'apidoc/v1',
        app,
        {
            ...documentAdmin,
            paths: Object.fromEntries(
                Object.entries(documentAdmin.paths).filter(
                    ([key]) =>
                        key.includes('admin') ||
                        (key.includes('auth') &&
                            !key.includes('register') &&
                            !key.includes('login-user') &&
                            !key.includes('logout-user')),
                ),
            ),
        },
        {
            swaggerOptions: {
                defaultModelsExpandDepth: -1,
            },
            useGlobalPrefix: false, // ✅ FIX
        },
    );

    // User Swagger
    SwaggerModule.setup(
        'apidoc/v1/user',
        app,
        {
            ...documentApi,
            paths: Object.fromEntries(
                Object.entries(documentApi.paths).filter(
                    ([key]) =>
                        !key.includes('admin') ||
                        (key.includes('auth') &&
                            !key.includes('login-admin') &&
                            !key.includes('logout-admin')),
                ),
            ),
        },
        {
            swaggerOptions: {
                defaultModelsExpandDepth: -1,
            },
            useGlobalPrefix: false, // ✅ FIX
        },
    );

    await app.listen(configService.getOrThrow('PORT'), () => {
        logger.debug(
            `[${configService.get('PROJECT_NAME')} | ${configService.get('NODE_ENV')}] is running: ${configService.get('BACKEND_URL')}/apidoc/v1`,
        );
    });
}

bootstrap().catch(console.error);
