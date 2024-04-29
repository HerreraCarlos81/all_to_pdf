# All to PDF - AI Facilitator

*** Contributions and suggestions are very welcome! ***

All to PDF - AI Facilitator is a powerful Visual Studio Code extension that allows you to generate a compiled PDF document from your project files. With just a few clicks, you can compile all your code files, data files, image files, and text files into a single, well-organized PDF.

The Goal of this project was to enable developers to easily create a single project PDF for several benefits:

- Upload the PDF to AI chatbots to be able to chat about the entire project context. 🤖
- Save PDF representations of the project code and assets for IP and other related business. 🔒
- Sharing of code for review in a common file format for those who like paper ✒️

## Features

- Recursively collects all files in a selected folder and its subfolders
- Supports various file types, including:
  - Code files: `.js`, `.ts`, `.py`, `.java`, `.c`, `.cpp`, `.cs`, `.php`, `.rb`, `.go`
  - Data files: `.json`, `.csv`, `.xml`, `.yml`, `.yaml`
  - Image files: `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`
  - Text files: `.txt`, `.md`, `.html`, `.css`
- Adds a header to the first page of the PDF with the project name
- Adds a footer to the last page of the PDF with creation details and a link to the extension's GitHub repository
- Sets metadata for the generated PDF, including title, author, subject, and keywords
- Provides a command to generate the PDF from the current folder

## Installation

To install the All to PDF - AI Facilitator extension in Visual Studio Code, follow these steps:

1. Open Visual Studio Code.
2. Click on the Extensions icon in the Activity Bar on the left side of the window.
3. In the search bar, type "All to PDF - AI Facilitator".
4. Click on the "Install" button next to the extension.
5. Once the installation is complete, you're ready to use the extension!

## Usage

To generate a PDF from your project files using the All to PDF - AI Facilitator extension, follow these steps:

1. Open your project folder in Visual Studio Code.
2. Right-click on the folder you want to generate the PDF from.
3. Select "Generate PDF from Project" from the context menu.
4. Wait for the extension to process your files and generate the PDF.
5. Once the process is complete, you will see a success message in the VS Code window.
6. The generated PDF will be saved in the same folder with the name "PDF Compiled Project.pdf".

## Creating a VS Code Extension

Here are the basic steps we took to create the All to PDF - AI Facilitator extension for Visual Studio Code:

1. Set up the development environment:
   - Install Node.js and Visual Studio Code.
   - Install the necessary VS Code extensions for extension development.

2. Create a new extension project:
   - Open a terminal and navigate to the desired directory.
   - Run `yo code` to generate a new extension project using the Yeoman generator.
   - Follow the prompts to set up the extension project.

3. Implement the extension functionality:
   - Open the generated extension project in Visual Studio Code.
   - Modify the `extension.js` file to implement the desired functionality.
   - Use the `vscode` module to interact with the VS Code API.
   - Use the `pdf-lib` library to generate the PDF document.
   - Use the `fs-extra` module for file system operations.
   - Implement functions to collect files, add content to the PDF, and save the generated PDF.

4. Test the extension:
   - Press `F5` to start debugging the extension in a new VS Code window.
   - Open a project folder and test the extension by generating a PDF.
   - Debug and fix any issues that arise during testing.

5. Package and publish the extension:
   - Update the `package.json` file with the extension details and dependencies.
   - Create a `.vscodeignore` file to exclude unnecessary files from the extension package.
   - Run `vsce package` to package the extension into a `.vsix` file.
   - Publish the extension to the Visual Studio Code Marketplace or share it with others.

By following these steps and leveraging the power of the VS Code API and external libraries, we were able to create the All to PDF - AI Facilitator extension that simplifies the process of generating a comprehensive PDF from project files.

This markdown readme file provides an overview of the All to PDF - AI Facilitator extension, including its features, installation instructions, usage guide, and a basic explanation of the steps involved in creating the extension.


Feel free to customize and expand upon this readme file based on your specific extension details and requirements.