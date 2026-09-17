const { Plugin, PluginSettingTab, Setting, Notice, FileSystemAdapter } = require("obsidian");

const BTN_CLASS = "copy-absolute-path-action";
const DEFAULT_SETTINGS = { template: "{{path}}" };

function render(template, path, basename) {
	return template
		.replaceAll("{{path}}", path)
		.replaceAll("{{wikilink}}", "[[" + basename + "]]");
}

module.exports = class CopyAbsolutePath extends Plugin {
	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.addSettingTab(new CopyAbsolutePathSettingTab(this.app, this));

		this.addCommand({
			id: "copy-absolute-path",
			name: "Copy absolute path of current file",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) this.copy(file);
				return true;
			},
		});

		const decorate = () => this.addButtons();
		this.app.workspace.onLayoutReady(decorate);
		this.registerEvent(this.app.workspace.on("layout-change", decorate));
		this.registerEvent(this.app.workspace.on("active-leaf-change", decorate));
	}

	onunload() {
		this.app.workspace.containerEl
			.querySelectorAll("." + BTN_CLASS)
			.forEach((el) => el.remove());
	}

	// Obsidian does not track view actions for us, so skip views that already have one.
	addButtons() {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view.containerEl.querySelector("." + BTN_CLASS)) continue;
			const btn = view.addAction("copy", "Copy path", () => {
				if (view.file) this.copy(view.file);
			});
			btn.addClass(BTN_CLASS);
		}
	}

	async copy(file) {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice("Absolute paths are only available on desktop");
			return;
		}
		const path = adapter.getFullPath(file.path);
		const text = render(this.settings.template, path, file.basename);
		await navigator.clipboard.writeText(text);
		new Notice("Copied: " + text);
	}
};

class CopyAbsolutePathSettingTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		this.containerEl.empty();

		new Setting(this.containerEl)
			.setName("Copy template")
			.setDesc(
				"What gets copied. Tokens: {{path}} = absolute path, {{wikilink}} = [[note name]]. Any other characters are copied literally, e.g. <{{path}}>"
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.template)
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value || DEFAULT_SETTINGS.template;
						await this.plugin.saveData(this.plugin.settings);
					})
			);
	}
}
