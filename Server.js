const http = require("http"); // Imports the HTTP module to create and manage an HTTP server that listens for incoming requests.
const url = require("url"); // Imports the URL module to parse request URLs and extract the pathname component.
const fs = require("fs"); // Imports the File System module to read files and interact with the local filesystem.
const colorette = require("colorette"); // Imports the Colorette module to add color to console output.

const settingsPath = require("path"); // Imports the Path module to work with file and directory paths.

// Default configuration object
const defaultConfig = {
  "server": {
    "port": 80,
    "root": "./www/",
    "logLevel": 3
  },
  "templates": {
    "404": "./templates/404.html",
    "403": "./templates/403.html"
  },
  "mimetypes": {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "txt": "text/plain",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "ico": "image/x-icon",
    "ttf": "application/x-font-ttf",
    "otf": "application/x-font-otf",
    "bin": "application/octet-stream",
    "mp4": "video/mp4",
    "webm": "video/webm"
  }
};

// Path to the settings.json file
const settingsFilePath = settingsPath.join(__dirname, "settings.json");

// Check if settings.json exists
if (!fs.existsSync(settingsFilePath)) {
  // If the file doesn't exist, create it and write the default configuration
  fs.writeFileSync(settingsFilePath, JSON.stringify(defaultConfig, null, 2));
  console.log(colorette.yellow("settings.json not found. A new one has been created with default settings."));
} else {
  console.log(colorette.gray("settings.json already exists."));
}

// Now require the settings.json file to load the configuration
const config = require(settingsFilePath);

// 1: No log
// 2: Log errors
// 3: Log errors and requests
// 4: debug
const path = config.server.root; // Specify the path to your folder

if (!fs.existsSync(path)) {
  // Folder doesn't exist, so create it
  fs.mkdirSync(path, { recursive: true }); // { recursive: true } ensures that nested folders are created if needed
  console.log(colorette.yellow("Folder was not found. A new one was created!"));
} else {
  console.log(colorette.gray("Folder already exists."));
}

class logHandler { // Class to handle logging messages to the console with different colors based on the message type.
  success(string) {
    if (config.server.logLevel >= 3) {
      this.logWithTimestamp(colorette.green(string));
    }
  }
  failure(string) {
    if (config.server.logLevel >= 2) {
    this.logWithTimestamp(colorette.red(string));
    }
  }
  warning(string) {
    if (config.server.logLevel >= 2) {
    this.logWithTimestamp(colorette.yellow(string));
    }
  }
  debug(string) {
    if (config.server.logLevel >= 4) {
    this.logWithTimestamp(colorette.cyan(string));
    }
  }
  info(string) {
    if (config.server.logLevel >= 3) {
    this.logWithTimestamp(colorette.blue(string));
    }
  }
  null(string) {
    if (config.server.logLevel >= 4) {
    this.logWithTimestamp(colorette.gray(string));
    }
  }
  blank() {
    if (config.server.logLevel >= 2) {
    console.log(""); // Adds a blank line to separate log entries for different requests.
    }
  }
  // Function to log messages with a timestamp for debugging and monitoring HTTP requests.
  logWithTimestamp(data){
    console.log('[*] ' + new Date(Date.now()).toLocaleTimeString('en-US') + ' - ' + data); // Logs messages with a timestamp in 'HH:MM:SS AM/PM' format.
  }

  logMemoryUsage() {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    const message = colorette.blue(`Memory Usage: ${Math.round(used * 100) / 100} MB`);

    process.stdout.clearLine(0);  // Clear the last line
    process.stdout.cursorTo(0);   // Move cursor to the beginning
    process.stdout.write(message); // Write the updated memory usage in color
  }
}

setInterval(() => logs.logMemoryUsage(), 5000); // Updates every 5 seconds

const logs = new logHandler(); // Creates an instance of the logHandler class to handle logging messages.

function logUserIpv4(request) {
  const ip = request.connection.remoteAddress; // Extracts the client's IP address from the request.
  logs.info("Client's IPv4 address: " + ip); // Logs the client's IP address to the console.
}

// Function to determine the correct MIME type for a given file extension.
function getMimeType(extension) {
  if (config.mimetypes[extension]) return config.mimetypes[extension]; // If the extension is found in settings.json, return the corresponding MIME type.
  return config.mimetypes['html']; // If the extension is not found, default to 'text/html'.
}

// Function to read a file from the given pathname. If a directory is requested, it attempts to serve an index.html file.
function readFile(pathname) {
  try {
    const data = fs.readFileSync(pathname); // Read the file synchronously from the given pathname.
    return data;
  } catch (err) {
    if (err.code === 'EISDIR') { // If the requested path is a directory, attempt to serve an index file.
      let indexFile = 'index.html'; // Default index file name.
      let reqDir = fs.readdirSync(pathname); // Retrieve the list of files in the directory.
      reqDir.forEach((f) => {
        if (f.includes('index')) // If a file contains "index" in its name, update indexFile to that file.
          indexFile = f;
      });
      return readFile(pathname + '/' + indexFile); // Recursively attempt to read the determined index file.
    }
    logs.failure(err); // Log an error message in red text to the console.
    throw err; // If an error occurs that is not related to a directory, propagate the error.
  }
}

// Creates an HTTP server that listens for requests, serves static files, and handles errors appropriately.
const server = http.createServer((request, response) => {
  let pathname = url.parse(request.url).pathname; // Extracts the pathname from the requested URL (e.g., '/index.html').
  
  // Remove the trailing slash from the pathname if present to standardize paths.
  if (pathname[pathname.length - 1] == '/')
      pathname = pathname.substr(0, pathname.length - 1);

  logUserIpv4(request); // Logs the client's IPv4 address.
  
  logs.info(request.method + " " + pathname); // Logs the HTTP request method (GET, POST, etc.) and requested path.
  
  // Determine the file extension from the requested pathname.
  let fileExtArr = pathname.split('.'); // Split the pathname by '.' to extract the extension.
  let fileExtension = fileExtArr[fileExtArr.length - 1]; // Get the last segment as the file extension.
  
  // Construct the full path of the requested file by appending it to the configured root directory.
  let reqFile = config.server.root + pathname.substr(1);
  
  let resMimeType = getMimeType(fileExtension); // Retrieve the correct MIME type for the file extension.
  logs.null("Serving MIME Type: " + resMimeType); // Log the MIME type being served.

  try {
    let fileContent = readFile(reqFile); // Attempt to read the requested file.
    response.writeHead(200, { 'Content-Type': resMimeType}); // Set the HTTP response status to 200 (OK) with the correct MIME type.
    response.write(fileContent); // Write the file content to the response body.
  } catch (err) {
    logs.failure("File not found: " + reqFile); // Log an error message when the requested file does not exist.
    response.writeHead(404, { 'Content-Type': 'text/html' }); // Set the HTTP response status to 404 (Not Found) with an HTML content type.
    const notFoundPage = fs.readFileSync(config.templates["404"], 'utf8'); // Read the 404 error page from the configured templates.
    response.write(notFoundPage); // Serve the 404 error page content to the client.
  }

  logs.debug("Response sent to client."); // Log a debug message indicating that the response has been sent to the client.

  logs.blank(); // Add a newline to separate log entries for different requests.
  
  response.end(); // Ends the response, signaling that all data has been sent to the client.
});

// Starts the server and makes it listen on the configured port, allowing it to accept incoming HTTP requests.
server.listen(config.server.port, () => {
  logs.info(`Server is listening on port: ${config.server.port}`); // Logs a message indicating the server has started successfully.
});
