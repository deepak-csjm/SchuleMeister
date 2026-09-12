import { handlers } from '@/auth';

export const { GET, POST } = handlers;

// Prisma and nodemailer require the Node.js runtime.
export const runtime = 'nodejs';
