# HW Command Scripts - Obsidian Plugin Framework

A modular framework for custom scripts accessible via Obsidian's command palette. This plugin provides a structured way to add and manage multiple utility scripts within a single plugin.

## 🎯 What This Plugin Does

This plugin creates a **command framework** that allows you to easily add custom scripts as Obsidian commands. Currently includes:

### **Reddit Post Parser**
- **Command:** "Paste Reddit Posts from Copied Subreddit Directory"
- **Function:** Parses Reddit HTML from clipboard and formats posts as markdown links
- **Input:** HTML copied from Reddit subreddit pages
- **Output:** Formatted markdown like: `- 202406181245 - [Post Title](https://reddit.com/r/sub/comments/postid/)`
- **Features:**
  - Converts UTC timestamps to EDT (UTC-4)
  - Automatically pastes into active editor
  - Copies results to clipboard as backup

## 🏗️ Plugin Architecture

The plugin uses a modular command system built around the `ScriptCommand` interface:

```typescript
interface ScriptCommand {
    id: string;           // Unique command identifier
    name: string;         // Display name in command palette
    description: string;  // Description for settings panel
    execute(plugin: HWCommandPlugin): Promise<void>; // Command logic
}
```

### **Core Components:**
- **`HWCommandPlugin`** - Main plugin class that manages commands
- **`ScriptCommand`** - Interface for all script commands
- **`HWCommandSettingTab`** - Settings panel with debug mode and command list
- **Command Classes** - Individual script implementations

## 🔧 How to Add New Commands

### **Step 1: Create Your Command Class**
```typescript
class YourNewCommand implements ScriptCommand {
    id = 'your-command-id';
    name = 'Your Command Name';
    description = 'What your command does';

    async execute(plugin: HWCommandPlugin): Promise<void> {
        try {
            // Your command logic here
            new Notice('Command executed successfully!');
        } catch (error) {
            new Notice(`Error: ${error.message}`);
            console.error('Your command error:', error);
        }
    }
}
```

### **Step 2: Register Your Command**
In the `initializeCommands()` method, add your command:
```typescript
private initializeCommands() {
    this.commands.push(new RedditPostParserCommand());
    this.commands.push(new YourNewCommand()); // Add this line

    // Registration happens automatically
    this.commands.forEach(command => {
        this.addCommand({
            id: command.id,
            name: command.name,
            callback: () => command.execute(this)
        });
    });
}
```

### **Step 3: Build and Test**
```bash
npm run build
```

## 🛠️ Development Setup

### **Prerequisites**
- Node.js v16+ (`node --version`)
- npm or yarn package manager

### **Installation**
```bash
# Clone/navigate to plugin directory
cd .obsidian/plugins/hw-command

# Install dependencies
npm install

# Development build (watch mode)
npm run dev

# Production build
npm run build
```

### **Dependencies**
- **cheerio** - HTML parsing (equivalent to Python's BeautifulSoup)
- **obsidian** - Obsidian API types
- **typescript** - Type checking and compilation

## 📝 Command Development Guidelines

### **Best Practices:**
1. **Error Handling** - Always wrap command logic in try-catch blocks
2. **User Feedback** - Use `new Notice()` for user notifications
3. **Debug Logging** - Check `plugin.settings.enableDebugMode` before console logging
4. **Async Operations** - Use async/await for clipboard and file operations
5. **Editor Integration** - Check for active editor before inserting content

### **Common Patterns:**
```typescript
// Clipboard operations
const content = await navigator.clipboard.readText();
await navigator.clipboard.writeText(output);

// Editor operations
const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
if (activeView) {
    activeView.editor.replaceSelection(content);
}

// User notifications
new Notice('Success message');
new Notice(`Error: ${error.message}`);

// Debug logging
if (plugin.settings.enableDebugMode) {
    console.log('Debug info:', data);
}
```

## 🔍 Debugging

### **Enable Debug Mode:**
1. Open Obsidian Settings
2. Go to Community Plugins → HW Command Scripts
3. Toggle "Debug Mode" on
4. Check browser console (Ctrl+Shift+I) for detailed logs

### **Common Issues:**
- **Clipboard Access** - Requires HTTPS or localhost (Obsidian desktop is fine)
- **Missing Dependencies** - Run `npm install` if imports fail
- **Build Errors** - Check TypeScript errors with `npm run build`

## 📦 Plugin Structure

```
hw-command/
├── main.ts              # Main plugin file with all command logic
├── manifest.json        # Plugin metadata
├── package.json         # Node.js dependencies
├── tsconfig.json        # TypeScript configuration
├── esbuild.config.mjs   # Build configuration
└── styles.css           # Plugin styles (if needed)
```

## 🚀 Extending the Framework

This framework is designed to be easily extensible. Some ideas for new commands:

- **Text Processors** - Format copied text (markdown, HTML, etc.)
- **File Utilities** - Batch file operations, name formatting
- **API Integrations** - Fetch data from external services
- **Content Generators** - Templates, boilerplate text
- **Data Parsers** - CSV, JSON, XML processing

Each new command follows the same pattern: implement `ScriptCommand`, add to `initializeCommands()`, and build.

## 🔄 Development Workflow

### **Adding a New Command (Step-by-Step):**

1. **Plan Your Command**
   ```typescript
   // What will your command do?
   // What input does it need?
   // What output will it produce?
   // Any external dependencies?
   ```

2. **Implement the Command Class**
   ```typescript
   class MyNewCommand implements ScriptCommand {
       id = 'my-new-command';
       name = 'My New Command';
       description = 'Description of what it does';

       async execute(plugin: HWCommandPlugin): Promise<void> {
           // Implementation here
       }
   }
   ```

3. **Register in Framework**
   ```typescript
   // In initializeCommands() method:
   this.commands.push(new MyNewCommand());
   ```

4. **Test and Debug**
   ```bash
   npm run build
   # Reload Obsidian plugin
   # Test command via Command Palette
   ```

### **Testing Your Commands:**
- Use Debug Mode for detailed logging
- Test edge cases (empty clipboard, no active editor, etc.)
- Verify error handling with invalid inputs
- Check command appears in Command Palette

## 📋 Command Ideas & Templates

### **Text Processing Command Template:**
```typescript
class TextProcessorCommand implements ScriptCommand {
    id = 'text-processor';
    name = 'Process Text';
    description = 'Process clipboard text in some way';

    async execute(plugin: HWCommandPlugin): Promise<void> {
        try {
            const input = await navigator.clipboard.readText();
            if (!input) {
                new Notice('Clipboard is empty');
                return;
            }

            const processed = this.processText(input);
            await navigator.clipboard.writeText(processed);

            const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                activeView.editor.replaceSelection(processed);
                new Notice('Text processed and pasted');
            } else {
                new Notice('Text processed and copied to clipboard');
            }
        } catch (error) {
            new Notice(`Error: ${error.message}`);
        }
    }

    private processText(input: string): string {
        // Your text processing logic here
        return input.toUpperCase(); // Example
    }
}
```

### **File Operation Command Template:**
```typescript
class FileOperationCommand implements ScriptCommand {
    id = 'file-operation';
    name = 'File Operation';
    description = 'Perform operation on current file';

    async execute(plugin: HWCommandPlugin): Promise<void> {
        try {
            const activeFile = plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('No active file');
                return;
            }

            // Your file operation logic here
            new Notice(`Operated on: ${activeFile.name}`);
        } catch (error) {
            new Notice(`Error: ${error.message}`);
        }
    }
}
```

## 🛠️ Advanced Customization

### **Adding Settings for Your Commands:**
```typescript
interface HWCommandSettings {
    enableDebugMode: boolean;
    yourCustomSetting: string; // Add your settings here
}

const DEFAULT_SETTINGS: HWCommandSettings = {
    enableDebugMode: false,
    yourCustomSetting: 'default value'
}
```

### **Using External APIs:**
```typescript
class APICommand implements ScriptCommand {
    async execute(plugin: HWCommandPlugin): Promise<void> {
        try {
            const response = await fetch('https://api.example.com/data');
            const data = await response.json();
            // Process and use the data
        } catch (error) {
            new Notice(`API Error: ${error.message}`);
        }
    }
}
```

## 📄 License

MIT License - Feel free to modify and extend this framework for your needs.

## 🤝 Contributing

This is a personal utility framework, but feel free to:
- Fork and customize for your own needs
- Submit issues if you find bugs
- Share your command implementations as examples

## 📚 Resources

- [Obsidian Plugin API](https://github.com/obsidianmd/obsidian-api)
- [Obsidian Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Cheerio Documentation](https://cheerio.js.org/) (for HTML parsing)
