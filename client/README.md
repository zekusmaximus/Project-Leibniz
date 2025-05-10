# [Project-Leibniz] - An Interactive Speculative Fiction Experience

Welcome to [Project-Leibniz]! This project is an immersive web-based interactive speculative fiction experience where the story unfolds and adapts based on your choices and exploration. Navigate a dynamic map of interconnected narrative nodes, each revealing a new part of an evolving story that responds to the order of your discoveries and the paths you revisit.

## Description

[Project-Leibniz] (or your chosen project name) aims to create a unique storytelling platform. The core experience revolves around a graphical homepage featuring nodes that represent story fragments or decision points. As you click on these nodes, you delve into text-based story pages. Your journey influences the connections between nodes, their appearance, and ultimately, the narrative climax.

**Key Features (Planned/Implemented):**
* Interactive graphical node map for navigation.
* Dynamically evolving story based on user choices, visit order, and visit counts.
* Visual feedback on the node map: nodes change color/size, lines connect/change based on progression.
* A unique narrative endpoint triggered by specific user interactions and node states.
* (Optional: Inset mini-map for larger story graphs.)

## Tech Stack

This project is built with a modern full-stack JavaScript/TypeScript approach:

**Frontend (Client):**
* **React:** For building the user interface.
* **TypeScript:** For type safety and improved developer experience.
* **Vite:** As the frontend build tool and development server.
* **D3.js:** For creating and managing the dynamic, interactive node-based visualizations.
* **CSS/HTML:** Standard web technologies for structure and styling.

**Backend (Server):**
* **Node.js:** As the JavaScript runtime environment.
* **Express.js:** As the web application framework for building APIs.
* **MongoDB:** As the NoSQL database to store story content, node states, and user progression.
* **Mongoose:** As the ODM (Object Document Mapper) for interacting with MongoDB.

## Project Structure

The project is organized into two main directories:

* `/client`: Contains the React frontend application.
* `/server`: Contains the Node.js backend API.

Each directory has its own `package.json` and manages its own dependencies.

## Prerequisites

Before you begin, ensure you have the following installed on your system:
* [Node.js](https://nodejs.org/) (LTS version recommended, which includes npm)
* [Git](https://git-scm.com/)
* A MongoDB instance:
    * You can run MongoDB locally.
    * Or, for ease of use, create a free cluster on [MongoDB Atlas](https://cloud.mongodb.com/).

## Getting Started

Follow these steps to get the project up and running on your local machine:

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/](https://github.com/)Zekusmaximus/PROJECT-LEIBNIZ.git
    cd PROJECT-LEIBNIZ
    ```

2.  **Setup Backend:**
    * Navigate to the server directory:
        ```bash
        cd server
        ```
    * Install backend dependencies:
        ```bash
        npm install
        ```
    * Create a `.env` file in the `/server` directory (`server/.env`). This file will store your environment variables.
        * Add your MongoDB connection string and a port number (example below):
            ```env
            MONGODB_URI=your_mongodb_atlas_connection_string_or_local_uri
            PORT=3001
            ```
        * **Note:** Replace `your_mongodb_atlas_connection_string_or_local_uri` with your actual MongoDB connection string. The `.env` file is included in `.gitignore` and should not be committed to the repository.

3.  **Setup Frontend:**
    * Navigate to the client directory from the project root:
        ```bash
        cd ../client
        # Or if you are in the server directory: cd ../client
        # Or from the root: cd client
        ```
    * Install frontend dependencies:
        ```bash
        npm install
        ```

## Running the Application

You'll need to run the frontend and backend servers separately, typically in two different terminal windows.

1.  **Start the Backend Server:**
    * Navigate to the `/server` directory:
        ```bash
        cd server
        ```
    * Run the development server:
        ```bash
        npm run dev
        ```
    * The backend server should typically start on `http://localhost:3001` (or the port specified in your `server/.env` file). You should see a message indicating the server is running and MongoDB is connected.

2.  **Start the Frontend Development Server:**
    * Navigate to the `/client` directory:
        ```bash
        cd client
        ```
    * Run the development server:
        ```bash
        npm run dev
        ```
    * Vite will typically start the frontend application on `http://localhost:5173` (or another available port if 5173 is busy) and open it in your default web browser.

Once both servers are running, you can access the application by navigating to the frontend URL (e.g., `http://localhost:5173`) in your browser.

## Available Scripts

Inside the `/client` and `/server` directories, you can run various npm scripts defined in their respective `package.json` files.

**Client (`/client`):**
* `npm run dev`: Starts the Vite development server for the frontend.
* `npm run build`: Builds the frontend application for production.
* `npm run lint`: Lints the frontend codebase (if ESLint is configured).
* `npm run preview`: Serves the production build locally.

**Server (`/server`):**
* `npm run dev`: Starts the Node.js backend server using `nodemon` (for auto-restarts on file changes).
* `npm run start`: Starts the Node.js backend server using `node` (typically for production).

## Contributing (Optional)

If you plan to have others contribute or want to set guidelines for yourself: