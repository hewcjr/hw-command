import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, FuzzySuggestModal } from 'obsidian';
import * as cheerio from 'cheerio';

interface HWCommandSettings {
	enableDebugMode: boolean;
}

const DEFAULT_SETTINGS: HWCommandSettings = {
	enableDebugMode: false
}

// Base interface for all script commands
interface ScriptCommand {
	id: string;
	name: string;
	description: string;
	execute(plugin: HWCommandPlugin): Promise<void>;
}

// Reddit Post Parser Command
class RedditPostParserCommand implements ScriptCommand {
	id = 'reddit-post-parser';
	name = 'Paste Subreddit Main Directory';
	description = 'Parse Reddit HTML from clipboard and paste formatted posts';

	async execute(plugin: HWCommandPlugin): Promise<void> {
		try {
			// Get HTML from clipboard
			const htmlContent = await navigator.clipboard.readText();

			if (!htmlContent) {
				new Notice('Clipboard is empty');
				return;
			}

			if (plugin.settings.enableDebugMode) {
				console.log('Reddit parser: Processing clipboard content length:', htmlContent.length);
			}

			// Parse Reddit posts
			const posts = this.extractRedditPosts(htmlContent);

			if (posts.length === 0) {
				new Notice('No Reddit posts found in clipboard content. Make sure you copied HTML from a Reddit subreddit page.');
				return;
			}

			// Format output
			const output = posts.join('\n');

			if (plugin.settings.enableDebugMode) {
				console.log('Reddit parser: Generated output:', output);
			}

			// Copy to clipboard
			await navigator.clipboard.writeText(output);

			// Paste into active editor
			const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				activeView.editor.replaceSelection(output);
				new Notice(`Parsed and pasted ${posts.length} Reddit posts`);
			} else {
				new Notice(`Parsed ${posts.length} Reddit posts and copied to clipboard`);
			}

		} catch (error) {
			new Notice(`Error parsing Reddit posts: ${error.message}`);
			console.error('Reddit parser error:', error);
		}
	}

	private extractRedditPosts(htmlContent: string): string[] {
		const $ = cheerio.load(htmlContent);
		const posts = $('shreddit-post');
		const results: string[] = [];

		posts.each((_, elem) => {
			const post = $(elem);
			const title = post.attr('post-title');
			const slug = post.attr('permalink');
			const timestampStr = post.attr('created-timestamp');

			if (!title || !slug || !timestampStr) {
				return; // Skip this post if missing required data
			}

			// Extract the base URL without the slug
			const match = slug.match(/(\/r\/[^/]+\/comments\/[^/]+\/)/);
			if (!match) {
				return; // Skip if URL format doesn't match
			}

			const postUrl = `https://www.reddit.com${match[1]}`;

			// Convert timestamp to datetime object
			const utcTime = new Date(timestampStr);

			// Convert UTC to EDT (UTC-4)
			const edtOffsetMs = 4 * 60 * 60 * 1000;
			const edtTime = new Date(utcTime.getTime() - edtOffsetMs);

			// Format the time as YYYYMMDDHHmm
			const pad = (n: number) => n.toString().padStart(2, '0');
			const formattedTime =
				`${edtTime.getFullYear()}${pad(edtTime.getMonth() + 1)}${pad(edtTime.getDate())}` +
				`${pad(edtTime.getHours())}${pad(edtTime.getMinutes())}`;

			results.push(`- ${formattedTime} - [${title}](${postUrl})`);
		});

		return results;
	}
}

// Note Selection Modal
class NoteSelectionModal extends FuzzySuggestModal<TFile> {
	private onSelect: (file: TFile) => void;

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelect = onSelect;
		this.setPlaceholder('Select a note to sort timestamps in...');
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		console.log('NoteSelectionModal: File selected:', file.path);
		this.onSelect(file);
	}
}

// Section Selection Modal
class SectionSelectionModal extends FuzzySuggestModal<{heading: string, line: number}> {
	private file: TFile;
	private onSelect: (section: {heading: string, line: number}) => void;
	private sections: {heading: string, line: number}[] = [];

	constructor(app: App, file: TFile, sections: {heading: string, line: number}[], onSelect: (section: {heading: string, line: number}) => void) {
		super(app);
		this.file = file;
		this.sections = sections;
		this.onSelect = onSelect;
		this.setPlaceholder('Select a section to sort timestamps in...');
		console.log('SectionSelectionModal: Created with', this.sections.length, 'sections');
	}

	onOpen() {
		super.onOpen();
		console.log('SectionSelectionModal: Opening modal for file:', this.file.path);
		console.log('SectionSelectionModal: Available sections:', this.sections.length);
	}

	getItems(): {heading: string, line: number}[] {
		console.log('SectionSelectionModal: getItems called, sections count:', this.sections.length);
		return this.sections;
	}

	getItemText(section: {heading: string, line: number}): string {
		return section.heading;
	}

	onChooseItem(section: {heading: string, line: number}, evt: MouseEvent | KeyboardEvent): void {
		console.log('SectionSelectionModal: Section selected:', section.heading);
		this.onSelect(section);
	}
}

// Timestamp utilities
interface TimestampedEntry {
	line: string;
	timestamp: Date | null;
	originalIndex: number;
}

class TimestampParser {
	// Parse timestamp from line format: "- YYYYMMDD - " or "- YYYYMMDDHHmm - "
	static parseTimestamp(line: string): Date | null {
		// Match patterns: "- YYYYMMDD - " or "- YYYYMMDDHHmm - "
		const timestampMatch = line.match(/^-\s+(\d{8}|\d{12})\s+-\s+/);
		if (!timestampMatch) {
			return null;
		}

		const timestampStr = timestampMatch[1];

		if (timestampStr.length === 8) {
			// YYYYMMDD format
			const year = parseInt(timestampStr.substring(0, 4));
			const month = parseInt(timestampStr.substring(4, 6)) - 1; // Month is 0-indexed
			const day = parseInt(timestampStr.substring(6, 8));
			return new Date(year, month, day);
		} else if (timestampStr.length === 12) {
			// YYYYMMDDHHmm format
			const year = parseInt(timestampStr.substring(0, 4));
			const month = parseInt(timestampStr.substring(4, 6)) - 1; // Month is 0-indexed
			const day = parseInt(timestampStr.substring(6, 8));
			const hour = parseInt(timestampStr.substring(8, 10));
			const minute = parseInt(timestampStr.substring(10, 12));
			return new Date(year, month, day, hour, minute);
		}

		return null;
	}

	// Sort timestamped entries: latest first, non-timestamped at top
	static sortTimestampedEntries(entries: TimestampedEntry[]): TimestampedEntry[] {
		return entries.sort((a, b) => {
			// Non-timestamped entries go to the top
			if (!a.timestamp && !b.timestamp) {
				return a.originalIndex - b.originalIndex; // Preserve original order
			}
			if (!a.timestamp) return -1;
			if (!b.timestamp) return 1;

			// Sort timestamped entries by date (latest first)
			return b.timestamp.getTime() - a.timestamp.getTime();
		});
	}
}

// Sort Timestamped List Command
class SortTimestampedListCommand implements ScriptCommand {
	id = 'sort-timestamped-list';
	name = 'Sort Timestamped List';
	description = 'Sort timestamped entries in a selected note section chronologically';

	async execute(plugin: HWCommandPlugin): Promise<void> {
		try {
			if (plugin.settings.enableDebugMode) {
				console.log('SortTimestampedListCommand: Starting execution');
			}

			// Step 1: Select note
			const selectedFile = await this.selectNote(plugin.app);
			if (!selectedFile) {
				if (plugin.settings.enableDebugMode) {
					console.log('SortTimestampedListCommand: Note selection cancelled');
				}
				return; // User cancelled
			}

			if (plugin.settings.enableDebugMode) {
				console.log('SortTimestampedListCommand: Selected file:', selectedFile.path);
			}

			// Step 2: Select section
			const selectedSection = await this.selectSection(plugin.app, selectedFile);
			if (!selectedSection) {
				if (plugin.settings.enableDebugMode) {
					console.log('SortTimestampedListCommand: Section selection cancelled');
				}
				return; // User cancelled
			}

			if (plugin.settings.enableDebugMode) {
				console.log('SortTimestampedListCommand: Selected section:', selectedSection.heading, 'at line', selectedSection.line);
			}

			// Step 3: Sort timestamps in the selected section
			new Notice('Sorting list...');
			await this.sortTimestampsInSection(plugin, selectedFile, selectedSection);

		} catch (error) {
			new Notice(`Error sorting timestamps: ${error.message}`);
			console.error('Sort timestamps error:', error);
		}
	}

	private selectNote(app: App): Promise<TFile | null> {
		return new Promise((resolve) => {
			let resolved = false;
			const modal = new NoteSelectionModal(app, (file) => {
				if (!resolved) {
					resolved = true;
					resolve(file);
				}
			});

			// Handle modal close without selection
			const originalOnClose = modal.onClose;
			modal.onClose = () => {
				originalOnClose.call(modal);
				// Use a timeout to allow onChooseItem to run before we resolve with null
				setTimeout(() => {
					if (!resolved) {
						resolved = true;
						resolve(null);
					}
				}, 0);
			};
			
			modal.open();
		});
	}

	private async selectSection(app: App, file: TFile): Promise<{heading: string, line: number} | null> {
		const sections = await this.loadSectionsForFile(app, file);

		return new Promise((resolve) => {
			let resolved = false;

			const modal = new SectionSelectionModal(app, file, sections, (section) => {
				if (!resolved) {
					resolved = true;
					resolve(section);
				}
			});

			// Handle modal close without selection
			const originalOnClose = modal.onClose;
			modal.onClose = function() {
				originalOnClose.call(this);
				// Use a timeout to allow onChooseItem to run before we resolve with null
				setTimeout(() => {
					if (!resolved) {
						resolved = true;
						resolve(null);
					}
				}, 0);
			};

			modal.open();
		});
	}

	private async loadSectionsForFile(app: App, file: TFile): Promise<{heading: string, line: number}[]> {
		try {
			console.log('SortTimestampedListCommand: Loading sections for file:', file.path);
			const content = await app.vault.read(file);
			console.log('SortTimestampedListCommand: File content length:', content.length);

			const lines = content.split('\n');
			console.log('SortTimestampedListCommand: Total lines:', lines.length);

			const sections: {heading: string, line: number}[] = [];
			lines.forEach((line, index) => {
				// Log every line that starts with #
				if (line.startsWith('#')) {
					console.log(`SortTimestampedListCommand: Line ${index} starts with #: "${line}"`);
				}

				const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
				if (headingMatch) {
					console.log(`SortTimestampedListCommand: Found heading at line ${index}: "${line}"`);
					const level = headingMatch[1].length;
					const title = headingMatch[2];
					sections.push({
						heading: `${'  '.repeat(level - 1)}${title}`,
						line: index
					});
				}
			});

			console.log('SortTimestampedListCommand: Found', sections.length, 'headings');
			sections.forEach((section, i) => {
				console.log(`  ${i}: "${section.heading}" at line ${section.line}`);
			});

			// Add option for entire document
			sections.unshift({
				heading: '📄 Entire Document',
				line: -1
			});

			console.log('SortTimestampedListCommand: Sections loaded successfully, total:', sections.length);
			return sections;
		} catch (error) {
			console.error('Error loading sections:', error);
			return [{
				heading: '📄 Entire Document',
				line: -1
			}];
		}
	}

	private async sortTimestampsInSection(
		plugin: HWCommandPlugin,
		file: TFile,
		section: {heading: string, line: number}
	): Promise<void> {
		const content = await plugin.app.vault.read(file);
		const lines = content.split('\n');

		let startLine = 0;
		let endLine = lines.length - 1;

		if (section.line !== -1) {
			// Find section boundaries
			startLine = section.line + 1; // Start after the heading

			// Find the next heading of same or higher level, or end of file
			const currentHeadingLevel = this.getHeadingLevel(lines[section.line]);
			for (let i = startLine; i < lines.length; i++) {
				const headingLevel = this.getHeadingLevel(lines[i]);
				if (headingLevel > 0 && headingLevel <= currentHeadingLevel) {
					endLine = i - 1;
					break;
				}
			}
		}

		// Extract timestamped entries from the section
		const timestampedEntries: TimestampedEntry[] = [];
		const nonTimestampedLines: string[] = [];

		for (let i = startLine; i <= endLine; i++) {
			const line = lines[i];
			const timestamp = TimestampParser.parseTimestamp(line);

			if (timestamp !== null || line.match(/^-\s+\d{8,12}\s+-\s+/)) {
				// This is a timestamped entry (or malformed timestamp)
				timestampedEntries.push({
					line: line,
					timestamp: timestamp,
					originalIndex: i
				});
			} else {
				// Keep non-timestamped lines in their original positions
				nonTimestampedLines.push(line);
			}
		}

		if (timestampedEntries.length === 0) {
			new Notice('No timestamped entries found in the selected section');
			return;
		}

		// Sort the timestamped entries
		const sortedEntries = TimestampParser.sortTimestampedEntries(timestampedEntries);

		// Reconstruct the content
		const newLines = [...lines];

		// Clear the section
		for (let i = startLine; i <= endLine; i++) {
			newLines[i] = '';
		}

		// Insert sorted entries and preserve non-timestamped content
		let insertIndex = startLine;

		// Add sorted timestamped entries
		sortedEntries.forEach(entry => {
			if (insertIndex <= endLine) {
				newLines[insertIndex] = entry.line;
				insertIndex++;
			}
		});

		// Add any remaining non-timestamped lines
		nonTimestampedLines.forEach(line => {
			if (insertIndex <= endLine && line.trim() !== '') {
				newLines[insertIndex] = line;
				insertIndex++;
			}
		});

		// Remove empty lines at the end of the section
		while (insertIndex <= endLine) {
			newLines[insertIndex] = '';
			insertIndex++;
		}

		// Write back to file
		const newContent = newLines.join('\n');
		await plugin.app.vault.modify(file, newContent);

		new Notice(`Sorted ${sortedEntries.length} timestamped entries in "${section.heading}"`);

		if (plugin.settings.enableDebugMode) {
			console.log(`Sorted timestamps in ${file.path}, section: ${section.heading}`);
		}
	}

	private getHeadingLevel(line: string): number {
		const match = line.match(/^(#{1,6})\s+/);
		return match ? match[1].length : 0;
	}
}

export default class HWCommandPlugin extends Plugin {
	settings: HWCommandSettings;
	public commands: ScriptCommand[] = [];

	private initializeCommands() {
		// Add all script commands here
		this.commands.push(new RedditPostParserCommand());
		this.commands.push(new SortTimestampedListCommand());

		// Register each command with Obsidian
		this.commands.forEach(command => {
			this.addCommand({
				id: command.id,
				name: command.name,
				callback: () => command.execute(this)
			});
		});
	}

	async onload() {
		await this.loadSettings();

		// Initialize commands
		this.initializeCommands();

		// Add settings tab
		this.addSettingTab(new HWCommandSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class HWCommandSettingTab extends PluginSettingTab {
	plugin: HWCommandPlugin;

	constructor(app: App, plugin: HWCommandPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'HW Command Scripts Settings'});

		new Setting(containerEl)
			.setName('Debug Mode')
			.setDesc('Enable debug logging for troubleshooting')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDebugMode)
				.onChange(async (value) => {
					this.plugin.settings.enableDebugMode = value;
					await this.plugin.saveSettings();
				}));

		// Add information about available commands
		containerEl.createEl('h3', {text: 'Available Commands'});
		const commandList = containerEl.createEl('ul');

		this.plugin.commands.forEach(command => {
			const listItem = commandList.createEl('li');
			listItem.createEl('strong', {text: command.name});
			listItem.createEl('br');
			listItem.createEl('span', {text: command.description});
		});
	}
}
