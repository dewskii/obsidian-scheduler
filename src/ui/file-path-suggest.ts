import { AbstractInputSuggest, type App, type TFile } from "obsidian";

export class FilePathSuggest extends AbstractInputSuggest<TFile> {
	private fileExtension: string;
	private textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement, fileExtension = ".js") {
		super(app, inputEl);
		this.textInputEl = inputEl;
		this.fileExtension = fileExtension;
	}

	getSuggestions(inputStr: string): TFile[] {
		const lowerInput = inputStr.toLowerCase();
		const files = this.app.vault.getFiles();

		return files
			.filter((file) => {
				if (!file.path.endsWith(this.fileExtension)) {
					return false;
				}

				return file.path.toLowerCase().contains(lowerInput);
			})
			.sort((a, b) => {
				const aPath = a.path.toLowerCase();
				const bPath = b.path.toLowerCase();

				const aStartsWith = aPath.startsWith(lowerInput);
				const bStartsWith = bPath.startsWith(lowerInput);
				if (aStartsWith && !bStartsWith) return -1;
				if (!aStartsWith && bStartsWith) return 1;

				return a.path.length - b.path.length;
			})
			.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.addClass("scheduler-file-suggestion");

		const nameEl = el.createDiv({ cls: "suggestion-title" });
		nameEl.setText(file.basename);


		const pathEl = el.createDiv({ cls: "suggestion-note" });
		pathEl.setText(file.path);
	}

	selectSuggestion(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
		this.textInputEl.value = file.path;
		this.textInputEl.dispatchEvent(new Event("input", { bubbles: true }));
		this.close();
	}
}
