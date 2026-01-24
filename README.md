# RAKALL - AI-Powered Reminder App

A modern reminder application that uses AI to extract information from documents and text, helping you never miss important deadlines.

## Features

- 📄 **Document Scanner**: Upload or capture documents (bills, invoices, receipts) and automatically extract deadlines and information
- ✍️ **Text Scanner**: Paste text from emails, notes, or articles to extract tasks and reminders
- 🤖 **AI-Powered**: Uses OpenAI GPT-4 Vision and GPT-4 to intelligently extract dates, amounts, and tasks
- 📷 **Camera Integration**: Take photos directly from your device
- ⏰ **Flexible Reminders**: Set reminders from 1 day to 1 year before deadlines
- 💾 **Local Storage**: All reminders are saved locally in your browser

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key (optional - app works with mock data if not provided)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd RAKALL
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
VITE_OPENAI_API_KEY=your_openai_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Document Scanner
1. Click on the "Document" tab
2. Upload a document or take a photo using the camera
3. Click "Extract Information with AI"
4. Review the extracted information
5. Adjust reminder settings and create your reminder

### Text Scanner
1. Click on the "Text" tab
2. Paste your text (from emails, notes, etc.)
3. Click "Extract Tasks"
4. Review suggested reminders
5. Edit if needed, then approve to add to your reminders

## Tech Stack

- React 18
- Vite
- OpenAI API (GPT-4 Vision & GPT-4)
- date-fns
- Local Storage

## Project Structure

```
RAKALL/
├── src/
│   ├── components/
│   │   ├── DocumentScanner.jsx    # Main scanner component (merged document & text)
│   │   ├── DocumentScanner.css
│   │   ├── ReminderList.jsx
│   │   └── ReminderList.css
│   ├── services/
│   │   ├── aiService.js           # Document extraction service
│   │   └── textExtractionService.js # Text extraction service
│   ├── App.jsx
│   ├── App.css
│   ├── main.jsx
│   └── index.css
├── index.html
├── vite.config.js
└── package.json
```

## License

MIT
