# RAKALL - AI-Powered Reminder App

A modern reminder application that uses AI to scan documents (bills, invoices, receipts) and automatically extract important dates and information to create reminders.

## Features

- 📄 **Document Scanning**: Upload images or PDFs of bills, invoices, or any documents
- 🤖 **AI-Powered Extraction**: Automatically extracts dates, amounts, titles, and descriptions using OpenAI GPT-4 Vision
- 📅 **Smart Reminders**: Creates reminders with extracted information
- 🎨 **Beautiful UI**: Modern, responsive design with intuitive user experience
- 💾 **Local Storage**: Reminders are saved locally in your browser
- ✅ **Task Management**: Mark reminders as completed, filter by status

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key (optional, for AI extraction)

### Installation

1. Clone the repository or navigate to the project directory:
```bash
cd RAKALL
```

2. Install dependencies:
```bash
npm install
```

3. Set up OpenAI API key (optional):
   - Create a `.env` file in the root directory
   - Add your OpenAI API key:
   ```
   VITE_OPENAI_API_KEY=your_api_key_here
   ```
   - Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   
   **Note**: If you don't provide an API key, the app will use mock data for testing purposes.

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Upload a Document**: Click "Choose Document" and select an image or PDF file
2. **Extract Information**: Click "Extract Information with AI" to analyze the document
3. **Review Extracted Data**: The AI will extract dates, amounts, and other relevant information
4. **Create Reminder**: Fill in or adjust the reminder details and click "Create Reminder"
5. **Manage Reminders**: View, filter, and mark reminders as completed in the reminders list

## Project Structure

```
RAKALL/
├── src/
│   ├── components/
│   │   ├── DocumentScanner.jsx    # Document upload and AI extraction
│   │   ├── ReminderList.jsx       # Reminder display and management
│   │   └── *.css                  # Component styles
│   ├── services/
│   │   └── aiService.js           # AI integration for document processing
│   ├── App.jsx                    # Main application component
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Global styles
├── index.html                     # HTML template
├── vite.config.js                 # Vite configuration
└── package.json                   # Dependencies and scripts
```

## Technologies Used

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **OpenAI GPT-4 Vision**: AI document analysis
- **date-fns**: Date formatting and manipulation
- **CSS3**: Modern styling with gradients and animations

## API Integration

The app uses OpenAI's GPT-4 Vision API to analyze documents. The AI extracts:
- Document title/type
- Important dates (due dates, payment dates, etc.)
- Monetary amounts
- Descriptions and context

## Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

## Future Enhancements

- [ ] Backend integration for cloud storage
- [ ] Email/SMS notifications
- [ ] Calendar integration (Google Calendar, iCal)
- [ ] Multiple document formats support
- [ ] Recurring reminders
- [ ] Document categorization
- [ ] Export reminders to CSV/PDF

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!
