import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { ERROR_CODES } from '@klikkflow/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer, { type FileFilterCallback, MulterError } from 'multer';

const execFileAsync = promisify(execFile);
const unlinkAsync = promisify(fs.unlink);
const statAsync = promisify(fs.stat);

/**
 * Sanitize and validate file path to prevent directory traversal (CodeQL Alerts #101-106)
 * @param filePath - The file path to sanitize
 * @param baseDir - The allowed base directory (default: /tmp/uploads)
 * @returns Sanitized path or throws error if path traversal detected
 */
function sanitizeFilePath(filePath: string, baseDir = '/tmp/uploads'): string {
  // Resolve both paths to absolute paths
  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(filePath);

  // Check if resolved path is within base directory
  const relativePath = path.relative(resolvedBase, resolvedPath);
  const isWithinBase =
    relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);

  if (!isWithinBase) {
    throw new Error(`Path traversal attempt detected: ${filePath}`);
  }

  return resolvedPath;
}

export interface FileUploadConfig {
  destination?: string;
  maxFileSize?: number;
  maxFiles?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  preserveExtension?: boolean;
  generateUniqueName?: boolean;
  scanForVirus?: boolean;
  clamavPath?: string;
  validateMagicNumbers?: boolean;
  sanitizeFilename?: boolean;
  metadata?: boolean;
  hashAlgorithm?: 'md5' | 'sha1' | 'sha256' | 'sha512';
}

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
  hash?: string;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  uploadedAt: Date;
  uploadedBy?: string;
  ipAddress?: string;
  userAgent?: string;
  virusScanResult?: {
    scanned: boolean;
    clean: boolean;
    threat?: string;
  };
}

/**
 * Magic number signatures for file type validation
 */
const MAGIC_NUMBERS: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': [Buffer.from('RIFF'), Buffer.from('WEBP')],
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
  'application/zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06])],
  'application/x-rar': [Buffer.from('Rar!')],
  'application/x-7z-compressed': [Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])],
  'application/gzip': [Buffer.from([0x1f, 0x8b])],
  'text/plain': [
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from([0xff, 0xfe]),
    Buffer.from([0xfe, 0xff]),
  ],
  'application/msword': [Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  'application/vnd.openxmlformats-officedocument': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
};

/**
 * Dangerous file extensions that should always be blocked
 */
const DANGEROUS_EXTENSIONS = [
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.ws',
  '.wsf',
  '.wsc',
  '.wsh',
  '.ps1',
  '.ps1xml',
  '.ps2',
  '.ps2xml',
  '.psc1',
  '.psc2',
  '.msh',
  '.msh1',
  '.msh2',
  '.mshxml',
  '.msh1xml',
  '.msh2xml',
  '.scf',
  '.lnk',
  '.inf',
  '.reg',
  '.app',
  '.pif',
  '.hta',
  '.cpl',
  '.msc',
  '.jar',
  '.sh',
];

/**
 * Create secure file upload middleware
 */
export function createFileUploadMiddleware(config: FileUploadConfig = {}) {
  const {
    destination = '/tmp/uploads',
    maxFileSize = 10 * 1024 * 1024, // 10 MB
    maxFiles = 10,
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf'],
    blockedExtensions = DANGEROUS_EXTENSIONS,
    preserveExtension = true,
    generateUniqueName = true,
    sanitizeFilename = true,
  } = config;

  // Ensure upload directory exists
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, destination);
    },
    filename: (_req, file, cb) => {
      const sanitized = sanitizeFilename
        ? sanitizeFilenameString(file.originalname)
        : file.originalname;

      if (generateUniqueName) {
        const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
        const ext = preserveExtension ? path.extname(sanitized) : '';
        cb(null, `${path.basename(sanitized, ext)}-${uniqueSuffix}${ext}`);
      } else {
        cb(null, sanitized);
      }
    },
  });

  // File filter
  const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Check MIME type
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} is not allowed`));
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();

    // Block dangerous extensions
    if (blockedExtensions.includes(ext)) {
      return cb(new Error(`File extension ${ext} is blocked for security reasons`));
    }

    // Check allowed extensions
    if (allowedExtensions.length > 0 && !allowedExtensions.includes(ext)) {
      return cb(new Error(`File extension ${ext} is not allowed`));
    }

    // Sanitize filename for path traversal attempts
    if (file.originalname.includes('../') || file.originalname.includes('..\\')) {
      return cb(new Error('Invalid filename'));
    }

    cb(null, true);
  };

  // Create multer instance
  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
  });

  return {
    single: (fieldName: string) => createUploadHandler(upload.single(fieldName), config),
    array: (fieldName: string, maxCount?: number) =>
      createUploadHandler(upload.array(fieldName, maxCount), config),
    fields: (fields: multer.Field[]) => createUploadHandler(upload.fields(fields), config),
    any: () => createUploadHandler(upload.any(), config),
  };
}

/**
 * Process a single file with security checks
 */
async function processSingleFile(
  file: Express.Multer.File,
  config: FileUploadConfig,
  req: Request
): Promise<{ file?: UploadedFile; error?: string }> {
  try {
    // CodeQL fix: Sanitize file path to prevent traversal (Alerts #101, #102, #103)
    const sanitizedPath = sanitizeFilePath(file.path, config.destination);

    // Validate magic numbers
    const magicValidation = await validateFileMagicNumber(file, config);
    if (!magicValidation.valid) {
      await unlinkAsync(sanitizedPath);
      return { error: magicValidation.error };
    }

    // Scan for viruses
    const virusScan = await scanFileIfRequired(file, config);
    if (!virusScan.clean) {
      await unlinkAsync(sanitizedPath);
      return { error: virusScan.error };
    }

    // Calculate hash and create metadata
    const hash = config.hashAlgorithm
      ? await calculateFileHash(sanitizedPath, config.hashAlgorithm)
      : undefined;

    const metadata = config.metadata ? createFileMetadata(req, virusScan.result) : undefined;

    return {
      file: {
        ...file,
        path: sanitizedPath, // Use sanitized path
        hash,
        metadata,
      } as UploadedFile,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // CodeQL fix: Sanitize path before deletion (Alert #106)
    const safePath = sanitizeFilePath(file.path, config.destination);
    await unlinkAsync(safePath).catch(() => {
      // Intentionally ignore unlink errors - file may not exist or be locked
    });
    return { error: `Error processing file ${file.originalname}: ${errorMessage}` };
  }
}

/**
 * Validate file magic number if configured
 */
async function validateFileMagicNumber(
  file: Express.Multer.File,
  config: FileUploadConfig
): Promise<{ valid: boolean; error?: string }> {
  if (!config.validateMagicNumbers) {
    return { valid: true };
  }

  const isValid = await validateMagicNumber(file.path, file.mimetype);
  if (!isValid) {
    return {
      valid: false,
      error: `File ${file.originalname} content does not match declared MIME type`,
    };
  }

  return { valid: true };
}

/**
 * Scan file for viruses if configured
 */
async function scanFileIfRequired(
  file: Express.Multer.File,
  config: FileUploadConfig
): Promise<{ clean: boolean; error?: string; result?: { clean: boolean; threat?: string } }> {
  if (!config.scanForVirus) {
    return { clean: true };
  }

  const virusScanResult = await scanFileForVirus(file.path, config.clamavPath);
  if (!virusScanResult.clean) {
    return {
      clean: false,
      error: `File ${file.originalname} contains malware: ${virusScanResult.threat}`,
      result: virusScanResult,
    };
  }

  return { clean: true, result: virusScanResult };
}

/**
 * Create file metadata from request
 */
function createFileMetadata(
  req: Request,
  virusScanResult?: { clean: boolean; threat?: string }
): FileMetadata {
  return {
    uploadedAt: new Date(),
    uploadedBy: (req as { user?: { id: string } }).user?.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    virusScanResult: virusScanResult ? { scanned: true, ...virusScanResult } : undefined,
  };
}

/**
 * Log file upload audit event
 */
async function logUploadAuditEvent(req: Request, files: UploadedFile[]): Promise<void> {
  const globalWithAudit = global as {
    auditLogger?: { log: (event: unknown) => Promise<void> };
  };

  if (!globalWithAudit.auditLogger) {
    return;
  }

  await globalWithAudit.auditLogger.log({
    type: 'FILE_UPLOADED',
    severity: 'LOW',
    userId: (req as { user?: { id: string } }).user?.id,
    action: 'File upload',
    result: 'SUCCESS',
    details: {
      files: files.map((f) => ({
        filename: f.filename,
        originalname: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        hash: f.hash,
      })),
    },
  });
}

/**
 * Get uploaded files from request
 */
function getUploadedFiles(req: Request): Express.Multer.File[] {
  return req.file ? [req.file] : (req.files as Express.Multer.File[]) || [];
}

/**
 * Separate processing results into successful files and errors
 */
function separateProcessingResults(results: Array<{ file?: UploadedFile; error?: string }>): {
  processedFiles: UploadedFile[];
  errors: string[];
} {
  const processedFiles: UploadedFile[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.file) {
      processedFiles.push(result.file);
    }
    if (result.error) {
      errors.push(result.error);
    }
  }

  return { processedFiles, errors };
}

/**
 * Handle case when all files failed processing
 */
function handleAllFilesFailed(res: Response, errors: string[]): boolean {
  if (errors.length === 0) {
    return false;
  }

  res.status(400).json({
    success: false,
    error: {
      code: ERROR_CODES.FILE_UPLOAD_ERROR,
      message: 'File upload failed',
      details: errors,
    },
  });
  return true;
}

/**
 * Attach processed files to request
 */
function attachFilesToRequest(req: Request, processedFiles: UploadedFile[]): void {
  if (req.file) {
    (req as { file: UploadedFile }).file = processedFiles[0] as UploadedFile;
  } else {
    (req as { files: UploadedFile[] }).files = processedFiles as UploadedFile[];
  }
}

/**
 * Create upload handler with additional security checks
 */
function createUploadHandler(multerMiddleware: RequestHandler, config: FileUploadConfig) {
  return [
    multerMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const files = getUploadedFiles(req);
        if (files.length === 0) {
          return next();
        }

        // Process all files in parallel
        const results = await Promise.all(
          files.map((file) => processSingleFile(file, config, req))
        );

        // Separate successes from failures
        const { processedFiles, errors } = separateProcessingResults(results);

        // Handle all failures
        if (processedFiles.length === 0 && handleAllFilesFailed(res, errors)) {
          return;
        }

        // Attach files and log
        attachFilesToRequest(req, processedFiles);
        await logUploadAuditEvent(req, processedFiles);

        next();
      } catch (error) {
        next(error);
      }
    },
  ];
}

/**
 * Validate magic number of file
 */
async function validateMagicNumber(filePath: string, mimeType: string): Promise<boolean> {
  const signatures = MAGIC_NUMBERS[mimeType];
  if (!signatures || signatures.length === 0) {
    // No signature to validate against
    return true;
  }

  // CodeQL fix: Sanitize path before file access (Alert #104)
  const sanitizedPath = sanitizeFilePath(filePath);
  const buffer = Buffer.alloc(Math.max(...signatures.map((s) => s.length)));
  const fd = fs.openSync(sanitizedPath, 'r');

  try {
    fs.readSync(fd, buffer, 0, buffer.length, 0);

    for (const signature of signatures) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        return true;
      }
    }

    return false;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Scan file for viruses using ClamAV
 */
async function scanFileForVirus(
  filePath: string,
  clamavPath?: string
): Promise<{
  scanned: boolean;
  clean: boolean;
  threat?: string;
}> {
  if (!(clamavPath && fs.existsSync(clamavPath))) {
    return { scanned: false, clean: true };
  }

  try {
    const { stdout, stderr } = await execFileAsync(clamavPath, ['--no-summary', filePath]);

    if (stderr) {
      // ClamAV stderr output (warnings, etc.)
    }

    const output = stdout.toLowerCase();
    const clean = output.includes('ok') && !output.includes('found');

    if (!clean) {
      // Extract threat name
      const match = output.match(/: (.+) found/i);
      const threat = match ? match[1] : 'Unknown threat';
      return { scanned: true, clean: false, threat };
    }

    return { scanned: true, clean: true };
  } catch (error: unknown) {
    // ClamAV returns exit code 1 if virus is found
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
      const errorWithStdout = error as { code: number; stdout?: string };
      const match = errorWithStdout.stdout?.match(/: (.+) found/i);
      const threat = match ? match[1] : 'Unknown threat';
      return { scanned: true, clean: false, threat };
    }
    return { scanned: false, clean: true };
  }
}

/**
 * Calculate file hash
 */
async function calculateFileHash(filePath: string, algorithm: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // CodeQL fix: Sanitize path before file access (Alert #105)
    const sanitizedPath = sanitizeFilePath(filePath);
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(sanitizedPath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Sanitize filename
 */
function sanitizeFilenameString(filename: string): string {
  // Remove any path components
  const basename = path.basename(filename);

  // Remove special characters except dots and hyphens
  let sanitized = basename.replace(/[^a-zA-Z0-9.-]/g, '_');

  // Remove multiple dots (prevent extension spoofing)
  sanitized = sanitized.replace(/\.{2,}/g, '_');

  // Ensure filename doesn't start with a dot (hidden file)
  if (sanitized.startsWith('.')) {
    sanitized = `_${sanitized.substring(1)}`;
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

/**
 * Clean up uploaded files from request
 */
async function cleanupUploadedFiles(req: Request): Promise<void> {
  const files = req.file ? [req.file] : (req.files as Express.Multer.File[]) || [];

  for (const file of files) {
    try {
      // CodeQL fix: Sanitize path before deletion (Alert #101)
      const sanitizedPath = sanitizeFilePath(file.path);
      await unlinkAsync(sanitizedPath);
    } catch (_error) {
      // Ignore file cleanup errors
    }
  }
}

/**
 * Get error message for Multer error code
 */
function getMulterErrorMessage(code: string): string {
  switch (code) {
    case 'LIMIT_FILE_SIZE':
      return 'File too large';
    case 'LIMIT_FILE_COUNT':
      return 'Too many files';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Unexpected field';
    default:
      return 'File upload error';
  }
}

/**
 * Create file cleanup middleware
 */
export function createFileCleanupMiddleware() {
  return async (err: unknown, req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Clean up uploaded files on error
    if (err) {
      await cleanupUploadedFiles(req);
    }

    // Handle multer errors
    if (err instanceof MulterError) {
      const message = getMulterErrorMessage(err.code);

      res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.FILE_UPLOAD_ERROR,
          message,
          details: err.message,
        },
      });
      return;
    }

    next(err);
  };
}

/**
 * Create file type validation middleware
 */
export function createFileTypeValidator(allowedTypes: Record<string, string[]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.file ? [req.file] : (req.files as Express.Multer.File[]) || [];

    for (const file of files) {
      const fieldTypes = allowedTypes[file.fieldname];

      if (!fieldTypes) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Unexpected file field: ${file.fieldname}`,
          },
        });
        return;
      }

      if (!fieldTypes.includes(file.mimetype)) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Invalid file type for ${file.fieldname}. Allowed types: ${fieldTypes.join(', ')}`,
          },
        });
        return;
      }
    }

    next();
  };
}

/**
 * Create file size limiter per field
 */
export function createFieldSizeLimiter(limits: Record<string, number>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const files = req.file ? [req.file] : (req.files as Express.Multer.File[]) || [];

    for (const file of files) {
      const limit = limits[file.fieldname];

      if (limit && file.size > limit) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.FILE_TOO_LARGE,
            message: `File ${file.originalname} exceeds size limit for ${file.fieldname}`,
          },
        });
        return;
      }
    }

    next();
  };
}

/**
 * Validate download request filename
 */
function validateDownloadFilename(filename: unknown): {
  valid: boolean;
  filename?: string;
  error?: { code: string; message: string };
} {
  if (!filename || typeof filename !== 'string') {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Filename is required',
      },
    };
  }

  // Prevent path traversal
  if (filename.includes('../') || filename.includes('..\\')) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.SECURITY_VIOLATION,
        message: 'Invalid filename',
      },
    };
  }

  return { valid: true, filename };
}

/**
 * Validate file path is within base path
 */
function validateFilePath(
  filePath: string,
  basePath: string
): { valid: boolean; resolvedPath?: string; error?: { code: string; message: string } } {
  // Normalize and resolve paths to prevent traversal attacks
  const normalizedPath = path.normalize(filePath);
  const resolvedPath = path.resolve(normalizedPath);
  const resolvedBase = path.resolve(path.normalize(basePath));

  // Ensure the resolved path stays within the base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access denied',
      },
    };
  }

  return { valid: true, resolvedPath };
}

/**
 * Check if file exists
 */
async function checkFileExists(
  filePath: string
): Promise<{ exists: boolean; error?: { code: string; message: string } }> {
  try {
    await statAsync(filePath);
    return { exists: true };
  } catch (_error) {
    return {
      exists: false,
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'File not found',
      },
    };
  }
}

/**
 * Log file download audit event
 */
async function logDownloadAuditEvent(req: Request, filename: string): Promise<void> {
  const globalWithAudit = global as {
    auditLogger?: { log: (event: unknown) => Promise<void> };
  };

  if (!globalWithAudit.auditLogger) {
    return;
  }

  await globalWithAudit.auditLogger.log({
    type: 'FILE_DOWNLOADED',
    severity: 'LOW',
    userId: (req as { user?: { id: string } }).user?.id,
    action: 'File download',
    result: 'SUCCESS',
    details: { filename },
  });
}

/**
 * Set download security headers
 */
function setDownloadSecurityHeaders(res: Response): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
}

/**
 * Create secure file download middleware
 */
export function createSecureDownloadMiddleware(
  options: {
    basePath: string;
    allowedPaths?: string[];
    requireAuth?: boolean;
    logDownloads?: boolean;
  } = { basePath: '/uploads' }
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check authentication if required
      if (options.requireAuth && !(req as { user?: { id: string } }).user) {
        res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required',
          },
        });
        return;
      }

      // Validate filename
      const rawFilename = req.params.filename || req.query.filename;
      const filenameValidation = validateDownloadFilename(rawFilename);

      if (!filenameValidation.valid) {
        res.status(400).json({
          success: false,
          error: filenameValidation.error,
        });
        return;
      }

      const filename = filenameValidation.filename as string;
      // Sanitize filename to prevent path traversal - use only the basename
      const sanitizedFilename = path.basename(filename);
      const filePath = path.join(options.basePath, sanitizedFilename);

      // Validate file path
      const pathValidation = validateFilePath(filePath, options.basePath);

      if (!pathValidation.valid) {
        res.status(403).json({
          success: false,
          error: pathValidation.error,
        });
        return;
      }

      const resolvedPath = pathValidation.resolvedPath as string;

      // Check file exists
      const fileCheck = await checkFileExists(resolvedPath);

      if (!fileCheck.exists) {
        res.status(404).json({
          success: false,
          error: fileCheck.error,
        });
        return;
      }

      // Log download if enabled
      if (options.logDownloads) {
        await logDownloadAuditEvent(req, filename);
      }

      // Set security headers and send file
      setDownloadSecurityHeaders(res);

      res.download(resolvedPath, path.basename(filename), (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({
            success: false,
            error: {
              code: ERROR_CODES.INTERNAL_ERROR,
              message: 'Failed to download file',
            },
          });
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
