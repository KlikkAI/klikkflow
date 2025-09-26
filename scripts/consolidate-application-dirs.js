#!/usr/bin/env node

/**
 * Application Directory Consolidation Script (JavaScript version)
 *
 * Removes redundant nested application directories and consolidates files
 */

const fs = require('fs');
const path = require('path');

class ApplicationDirectoryConsolidator {
  constructor() {
    this.summary = {
      redundantDirsRemoved: 0,
      filesRemoved: 0,
      filesConsolidated: 0,
      stubsRemoved: 0,
      reExportsRemoved: 0
    };

    // Services with redundant nested structures
    this.REDUNDANT_SERVICES = [
      'errortracker',
      'healthcheck',
      'cursortracking',
      'collaboration',
      'debugtools',
      'operationaltransform'
    ];

    // Common stub patterns to remove
    this.STUB_PATTERNS = [
      'TODO: Implement business logic',
      'TODO: Implement',
      'Not implemented',
      'throw new Error(\'Not implemented\')'
    ];
  }

  async run() {
    console.log('🚀 Starting application directory consolidation...\n');

    const backendPath = path.join(process.cwd(), 'packages/backend/src');

    if (!fs.existsSync(backendPath)) {
      console.error('❌ Backend directory not found:', backendPath);
      return;
    }

    // Phase 1: Remove redundant nested directories
    await this.removeRedundantDirectories(backendPath);

    // Phase 2: Remove stub files
    await this.removeStubFiles(backendPath);

    // Phase 3: Remove unnecessary re-exports
    await this.removeReExports(backendPath);

    this.printSummary();
  }

  async removeRedundantDirectories(backendPath) {
    console.log('📁 Phase 1: Removing redundant nested directories...\n');

    for (const service of this.REDUNDANT_SERVICES) {
      await this.removeRedundantServiceDir(backendPath, service);
    }
  }

  async removeRedundantServiceDir(backendPath, serviceName) {
    // Find service directories (could be in different categories)
    const servicePaths = this.findServicePaths(backendPath, serviceName);

    for (const servicePath of servicePaths) {
      const redundantPath = path.join(servicePath, serviceName);

      if (fs.existsSync(redundantPath)) {
        console.log(`  🔍 Found redundant directory: ${redundantPath}`);

        const redundantAppPath = path.join(redundantPath, 'application');
        if (fs.existsSync(redundantAppPath)) {
          const fileCount = this.countFiles(redundantAppPath);
          console.log(`    📄 Contains ${fileCount} files`);

          // Check if main application directory exists and has files
          const mainAppPath = path.join(servicePath, 'application');
          if (fs.existsSync(mainAppPath)) {
            console.log(`    ✅ Main application directory exists, removing redundant one`);

            this.removeDirectory(redundantPath);
            this.summary.redundantDirsRemoved++;
            this.summary.filesRemoved += fileCount;

            console.log(`    ❌ Removed: ${redundantPath} (${fileCount} files)\n`);
          } else {
            console.log(`    🔄 Moving files from redundant to main directory`);
            this.moveDirectory(redundantAppPath, mainAppPath);
            this.removeDirectory(redundantPath);
            this.summary.redundantDirsRemoved++;
            console.log(`    ✅ Consolidated: ${fileCount} files moved\n`);
          }
        }
      }
    }
  }

  findServicePaths(backendPath, serviceName) {
    const paths = [];

    // Common patterns where services are located
    const searchPaths = [
      path.join(backendPath, 'services', 'monitoring', serviceName),
      path.join(backendPath, 'services', 'debugging', serviceName),
      path.join(backendPath, 'services', serviceName),
    ];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        paths.push(searchPath);
      }
    }

    return paths;
  }

  async removeStubFiles(backendPath) {
    console.log('🗑️  Phase 2: Removing stub files...\n');

    const applicationDirs = this.findAllApplicationDirs(backendPath);

    for (const appDir of applicationDirs) {
      const stubsRemoved = await this.removeStubFilesInDir(appDir);
      if (stubsRemoved > 0) {
        console.log(`  ❌ Removed ${stubsRemoved} stub files from ${appDir}`);
        this.summary.stubsRemoved += stubsRemoved;
      }
    }
  }

  async removeStubFilesInDir(dirPath) {
    let removed = 0;

    if (!fs.existsSync(dirPath)) return 0;

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      if (file.endsWith('.use-case.ts')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');

          // Check if it's a stub file
          const isStub = this.STUB_PATTERNS.some(pattern => content.includes(pattern)) ||
                        content.length < 300; // Very small files are likely stubs

          if (isStub) {
            fs.unlinkSync(filePath);
            removed++;
          }
        } catch (error) {
          console.log(`    ⚠️  Could not process ${filePath}: ${error.message}`);
        }
      }
    }

    return removed;
  }

  async removeReExports(backendPath) {
    console.log('🔄 Phase 3: Removing unnecessary re-exports...\n');

    const applicationDirs = this.findAllApplicationDirs(backendPath);

    for (const appDir of applicationDirs) {
      const reExportsRemoved = await this.removeReExportsInDir(appDir);
      if (reExportsRemoved > 0) {
        console.log(`  ❌ Removed ${reExportsRemoved} re-export files from ${appDir}`);
        this.summary.reExportsRemoved += reExportsRemoved;
      }
    }
  }

  async removeReExportsInDir(dirPath) {
    let removed = 0;

    if (!fs.existsSync(dirPath)) return 0;

    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      if (file.endsWith('.use-case.ts')) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');

          // Check if it's just a re-export
          const isReExport = content.includes('export {') &&
                            content.includes('from') &&
                            content.includes('@reporunner/core') &&
                            content.split('\n').length < 5;

          if (isReExport) {
            fs.unlinkSync(filePath);
            removed++;
          }
        } catch (error) {
          console.log(`    ⚠️  Could not process ${filePath}: ${error.message}`);
        }
      }
    }

    return removed;
  }

  findAllApplicationDirs(backendPath) {
    const applicationDirs = [];

    const findInDir = (dirPath) => {
      if (!fs.existsSync(dirPath)) return;

      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          const itemPath = path.join(dirPath, item.name);

          if (item.name === 'application') {
            applicationDirs.push(itemPath);
          } else {
            findInDir(itemPath);
          }
        }
      }
    };

    findInDir(backendPath);
    return applicationDirs;
  }

  countFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;

    let count = 0;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isFile()) {
        count++;
      } else if (item.isDirectory()) {
        count += this.countFiles(path.join(dirPath, item.name));
      }
    }

    return count;
  }

  removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  moveDirectory(srcPath, destPath) {
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }

    const items = fs.readdirSync(srcPath);

    for (const item of items) {
      const srcItemPath = path.join(srcPath, item);
      const destItemPath = path.join(destPath, item);

      if (fs.statSync(srcItemPath).isDirectory()) {
        this.moveDirectory(srcItemPath, destItemPath);
      } else {
        fs.copyFileSync(srcItemPath, destItemPath);
      }
    }
  }

  printSummary() {
    console.log('\n🎉 Application directory consolidation completed!\n');
    console.log('📊 Summary:');
    console.log(`  Redundant directories removed: ${this.summary.redundantDirsRemoved}`);
    console.log(`  Files removed: ${this.summary.filesRemoved}`);
    console.log(`  Stub files removed: ${this.summary.stubsRemoved}`);
    console.log(`  Re-export files removed: ${this.summary.reExportsRemoved}`);

    const totalReduction = this.summary.filesRemoved + this.summary.stubsRemoved + this.summary.reExportsRemoved;
    const reductionPercentage = Math.round((totalReduction / 1243) * 100);

    console.log(`\n💡 Total file reduction: ${totalReduction}/1,243 files (${reductionPercentage}%)`);
    console.log('\n✅ Directory structure optimized!');
    console.log('✅ Redundant nesting eliminated!');
    console.log('✅ Stub files removed!');

    console.log('\n📞 Next steps:');
    console.log('  1. Update import paths in remaining files');
    console.log('  2. Run tests to verify functionality');
    console.log('  3. Update documentation');
  }
}

// Run the consolidation
const consolidator = new ApplicationDirectoryConsolidator();
consolidator.run().catch(console.error);