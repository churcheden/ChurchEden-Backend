import { env } from './env.js';
import { app } from './app.js';
import { prisma } from './config/prisma.js';
import { redisClient } from './config/redis.js';

const PORT = env.PORT || 3000;

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const gracefulShutdown = async() => {
    console.log('Recieved kill signal, shutting down gracefully...');
    server.close(() => {
        console.log('Closed out remaining connnections');
    });

    try {
        await prisma.$disconnect();
        console.log('Prisma disconnected');

        if(redisClient.isOpen) {
            await redisClient.quit();
            console.log('Redis disconnect!');
        }

        process.exit(0);
    } catch(error) {
        console.log('Error during graceful shutdown ', error);
        process.exit(1);
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (error) => {
    console.error('UncaughtException:', error);
    gracefulShutdown();
});
process.on('unhandledRejection', (error) => {
    console.error('UnhandledRejection', error);
    gracefulShutdown();
});
