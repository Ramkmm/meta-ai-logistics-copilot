# AI Logistics & Supply Chain Copilot

**An AI-powered logistics decision-support application for Indian distributors, transport operators, and MSMEs.**

Built for the **Meta Global AI Developer Hackathon — October 26 to November 4, 2026**.

## Overview

AI Logistics & Supply Chain Copilot helps Indian small and medium-sized businesses understand delivery delays, monitor inventory shortages, track shipping costs, and prioritize operational decisions.

The application combines a React dashboard with a Python FastAPI backend and Meta Model API integration. It presents logistics data in an accessible interface and provides an AI-powered assistant to help users interpret business problems and explore practical next steps.

The initial version uses sample logistics data for demonstration. Live operational integrations with transport providers, ERP systems, GPS services, and inventory platforms are not yet implemented.

## Problem Statement

Indian distributors and MSMEs can face challenges such as:

- Delayed shipments and missed delivery commitments.
- Low inventory levels and potential stockouts.
- Increasing transportation and shipping costs.
- Limited visibility into operational performance.
- Difficulty deciding which logistics problems require immediate attention.

This project aims to make logistics information easier to understand and turn it into actionable operational insights.

## Key Features

### 1. Logistics Overview Dashboard

- Total shipment count.
- Delayed and on-time shipment indicators.
- On-time delivery percentage.
- Total sample shipping costs in Indian rupees.
- Visual analysis of shipment delays.

### 2. Shipment Tracking

- Shipment IDs and destinations.
- Delivery status.
- Delay duration in hours.
- Shipping cost per shipment.
- Sample destinations including Hyderabad, Warangal, Vijayawada, Khammam, and Karimnagar.

### 3. Inventory Monitoring

- Sample inventory stock levels.
- Reorder thresholds.
- Low-stock alerts.
- Identification of inventory items that may require replenishment.

### 4. AI Logistics Copilot

Users can ask questions about shipments, inventory, and logistics operations.

The intended AI workflow is to:
1. Interpret the user's business question.
2. Analyze the supplied logistics and inventory information.
3. Identify relevant risks and priorities.
4. Suggest practical actions.
5. Present a readable response in the dashboard.

AI analysis requires a valid Meta Model API key and active API access. If API credits or billing access are unavailable, the application may display a pending or unavailable AI status.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Frontend development server | Vite |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Python and FastAPI |
| API validation | Pydantic |
| AI integration | Meta Model API |
| API test | Python |
| Version control | Git and GitHub |

## Architecture

```text
User
  |
  v
React Dashboard
  |
  | HTTP requests
  v
FastAPI Backend
  |
  +---- Shipment data
  |
  +---- Inventory data
  |
  +---- Logistics analysis
  |
  v
Meta Model API
  |
  v
AI-generated business insights
  |
  v
Dashboard analysis results
```

The frontend and backend run separately during local development. The backend is responsible for serving logistics data and handling analysis requests.

## Project Structure

```text
meta-ai-logistics-copilot/
|
|-- logistics_app.py
|-- test_meta_api.py
|-- .env.example
|-- .gitignore
|-- README.md
|
|-- logistics-dashboard/
|   |-- package.json
|   |-- package-lock.json
|   |-- index.html
|   |-- vite.config.js
|   |-- public/
|   |-- src/
|       |-- App.jsx
|       |-- App.css
|       |-- index.css
|       |-- main.jsx
|
```

## Prerequisites

Install the following before running the project:

- Python 3.11 or a compatible Python version.
- Node.js and npm.
- Git.
- A Meta Model API account and API key for AI-powered analysis.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Ramkmm/meta-ai-logistics-copilot.git
cd meta-ai-logistics-copilot
```

### 2. Set up the Python environment

On Windows PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install fastapi uvicorn python-dotenv openai
```

Using the virtual environment's Python executable avoids the need to change PowerShell's script execution policy.

### 3. Configure the Meta Model API key

Copy the example environment file:

```powershell
Copy-Item .env.example .env
notepad .env
```

Add your own key locally:

```dotenv
MODEL_API_KEY=YOUR_META_MODEL_API_KEY
```

Replace the placeholder with your actual API key. Never commit `.env`, publish the key, or include it in screenshots or demo recordings.

### 4. Start the backend

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn logistics_app:app --reload --host 127.0.0.1 --port 8000
```

Open the backend documentation:

- Home: http://127.0.0.1:8000/
- Dashboard data: http://127.0.0.1:8000/dashboard
- Interactive API documentation: http://127.0.0.1:8000/docs

The backend must remain running while testing the frontend.

### 5. Start the React frontend

Open a second terminal:

```powershell
cd logistics-dashboard
npm.cmd install
npm.cmd run dev
```

Open the local dashboard:

http://localhost:5173/

If the terminal reports a different local URL, use the URL shown by Vite.

## Testing the Meta Model API

From the repository root, with the virtual environment configured and `.env` populated, run:

```powershell
.\.venv\Scripts\python.exe test_meta_api.py
```

The test should send a sample logistics question to the Meta Model API and print the model response.

If the request fails, verify:
- The API key is valid.
- The key belongs to the intended Meta Model API account and project.
- Model access and API credits or billing requirements are satisfied.
- The model identifier and endpoint match the current official API documentation.
- The network connection is working.

Official resources:

- Meta Model API: https://dev.meta.ai/
- API documentation: https://dev.meta.ai/docs/overview

## Sample Data and Limitations

The current prototype uses illustrative shipment and inventory records. These records are not connected to a live logistics provider or a real business database.

Consequently:
- Shipment status is sample data, not live GPS tracking.
- Inventory levels are illustrative, not synchronized with a warehouse.
- Shipping costs are sample values, not verified invoices.
- Recommendations depend on the supplied data and model output.
- Business decisions should be verified by the user before implementation.

No claim is made that the current prototype automatically reduces costs, guarantees delivery times, or prevents stockouts.

## Security

- Store API keys in the local `.env` file.
- Keep `.env` and `.venv/` excluded through `.gitignore`.
- Do not place secrets in frontend source code.
- For deployment, configure the API key through the backend hosting provider's environment-variable settings.
- Never expose the API key in browser requests, public logs, or repository files.

## Future Improvements

- Integration with real ERP and inventory systems.
- Live shipment tracking through authorized logistics APIs.
- Demand forecasting and inventory replenishment predictions.
- Delivery-delay risk scoring.
- Route and transportation cost optimization.
- Role-based access for distributors and operations teams.
- Persistent database support.
- Automated alerts for delayed shipments and low stock.
- Production deployment, monitoring, and automated tests.

## Hackathon Information

**Event:** Meta Global AI Developer Hackathon  
**Project:** AI Logistics & Supply Chain Copilot  
**Track:** Indie Developer, if entered under the individual participation track  
**Repository:** https://github.com/Ramkmm/meta-ai-logistics-copilot

This project is intended to demonstrate how Meta AI models can support practical logistics and supply-chain decision-making for Indian MSMEs.

## Author

**Rambabu Vaddeboina**

GitHub: https://github.com/Ramkmm

## License

No license has been added yet. Unless a license is included in this repository, reuse and redistribution are not automatically granted. Add an appropriate open-source license if you intend to permit public reuse.
