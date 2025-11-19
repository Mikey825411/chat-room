# 🌐 Retro Chat - Zero-Server Chat Application with File Sharing

A fully client-side chat application with 90s terminal aesthetic that runs entirely in your browser. No servers, no cloud, no accounts required. Now with comprehensive file sharing support!

## ✨ Features

### 🎯 Core Functionality
- **Public Room**: Real-time chat between tabs/windows on the same browser using BroadcastChannel API
- **Private P2P Rooms**: Direct peer-to-peer chat using WebRTC DataChannels with manual SDP exchange
- **No Authentication**: Set your display name and avatar locally via localStorage
- **90s Aesthetic**: Retro terminal interface with green-on-black theme and pixel fonts

### 📎 File Sharing Features
- **All File Types**: Support for images, videos, audio, documents, archives, and more
- **Smart Preview**: In-app preview for images, videos, audio, and text files
- **File Management**: Add multiple attachments, remove before sending, size validation
- **Download Support**: One-click download for any received file
- **Size Limits**: 10MB per file to ensure performance
- **Type Detection**: Automatic file type icons and appropriate handling

### 🔧 Technical Features
- **Zero Backend**: Runs entirely in the browser
- **No Registration**: Your profile is stored locally
- **Real-time Communication**: Uses native browser APIs
- **Manual P2P**: Copy/paste SDP exchange for private rooms
- **Responsive Design**: Works on desktop and mobile devices
- **Base64 Encoding**: Files are encoded for transmission without servers

## 🚀 Quick Start

### Method 1: Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

### Method 2: Static Hosting
1. Build the application: `npm run build`
2. Deploy the `out` folder to any static hosting service (Vercel, Netlify, GitHub Pages, etc.)
3. Or simply open `index.html` directly in your browser (file://)

## 📖 How to Use

### 🌍 Public Room
The public room works automatically between tabs/windows on the same browser:

1. **Set Your Profile**: Click the "PROFILE" button to set your display name and optional avatar
2. **Start Chatting**: Type in the message box and press Enter or click Send
3. **Add Attachments**: Click "ATTACH" to add files (max 10MB each)
4. **Manage Files**: Review attachment list, remove files before sending if needed
5. **Real-time Updates**: Messages and files appear instantly in all tabs on the same browser
6. **Preview & Download**: Click on media files to preview, use download button for any file

**Note**: Public room only works between tabs on the same browser/device. It does not work across different devices or browsers.

### 🔒 Private P2P Room
Private rooms use WebRTC for direct peer-to-peer communication without any servers:

#### Step-by-Step Connection:

**HOST (Creates the room):**
1. Go to the "PRIVATE ROOM" tab
2. Click "CREATE OFFER" 
3. Copy the generated SDP offer text using the "COPY OFFER" button
4. Send this offer text to your chat partner (via any messaging service)

**GUEST (Joins the room):**
1. Go to the "PRIVATE ROOM" tab
2. Paste the SDP offer text into the "Paste offer here..." field
3. Click "CREATE ANSWER"
4. Copy the generated SDP answer text using the "COPY ANSWER" button
5. Send this answer text back to the host

**HOST (Finalizes connection):**
1. Paste the SDP answer text into the "Paste answer here..." field
2. Click "CONNECT"
3. Wait for the connection status to change to "CONNECTED"
4. Start chatting privately with file sharing!

#### File Sharing in Private Rooms:
- **Add Files**: Click "ATTACH" to select multiple files
- **Preview Media**: Images, videos, and audio can be previewed directly
- **Download Any File**: All files can be downloaded with one click
- **File Info**: See file type, size, and name for each attachment

#### Connection Status Indicators:
- **DISCONNECTED**: No active connection
- **CONNECTING**: SDP exchange in progress
- **CONNECTED**: Ready for private messaging and file sharing

## ⚠️ Limitations & Important Notes

### 📁 File Sharing Limitations
1. **File Size**: Maximum 10MB per file to ensure performance
2. **Browser Memory**: Large files consume browser memory during transfer
3. **Base64 Overhead**: Files are encoded as base64, increasing size by ~33%
4. **No Resumable Uploads**: Failed transfers must be restarted
5. **Concurrent Files**: Multiple large files may impact performance

### 🔧 Technical Limitations
1. **Manual Signalling**: P2P requires manual copy/paste of SDP offers/answers
2. **NAT Issues**: Some network configurations (strict NATs, corporate firewalls) may block P2P connections
3. **No TURN Server**: Only public STUN servers are used. Without TURN, some connections will fail
4. **Browser Support**: Requires modern browsers with WebRTC and BroadcastChannel support

### 🌐 Network Limitations
1. **Public Room**: Only works between tabs on the same browser/device
2. **P2P Room**: May fail behind restrictive NATs or firewalls
3. **No Persistence**: Messages are not saved and disappear when the page is refreshed
4. **No Server**: No fallback mechanism if P2P connection fails

### 🔒 Security & Privacy
1. **Anyone Can Connect**: Anyone with the SDP offer can attempt to join a P2P room
2. **No Encryption**: WebRTC DataChannels are encrypted, but the SDP exchange is not
3. **Local Storage**: Profile data is stored locally and can be cleared by the user
4. **No Authentication**: No verification of user identities

### 📱 Browser Compatibility
- **Chrome/Edge**: Full support for all features
- **Firefox**: Full support for all features
- **Safari**: WebRTC supported, but may have stricter NAT policies
- **Mobile Browsers**: Generally supported, but P2P may be less reliable

## 🎨 Design & UX

### 90s Terminal Aesthetic
- **Pixel Font**: Press Start 2P for authentic retro feel
- **Green Terminal**: Classic green-on-black color scheme
- **Scanlines**: Subtle scanline effects for CRT monitor feel
- **Boxy Windows**: Retro window decorations with control buttons
- **Neon Accents**: Bright green borders and highlights

### User Experience
- **Clear Instructions**: Step-by-step guidance for P2P connections
- **Smart File Icons**: Automatic file type detection with appropriate icons
- **Preview System**: In-app preview for media files and text content
- **Download Management**: One-click download with proper file names
- **Progress Indicators**: Visual feedback for file operations
- **Responsive**: Works on both desktop and mobile devices
- **Keyboard Support**: Enter to send messages, accessible navigation

### 📎 File Type Support
- **Images**: JPG, PNG, GIF, WebP, SVG (with preview)
- **Videos**: MP4, WebM, OGG (with preview)
- **Audio**: MP3, WAV, OGG (with preview)
- **Documents**: PDF, DOC, TXT (with text preview)
- **Archives**: ZIP, RAR, 7Z (download only)
- **Other Files**: Any file type supported for download

## 🛠️ Troubleshooting

### 📁 File Sharing Issues
1. **File Too Large**: Check file size under 10MB limit
2. **Preview Not Working**: Ensure file type is supported for preview
3. **Download Fails**: Check browser download permissions
4. **Memory Issues**: Close unused tabs, reduce file sizes

### 🔌 P2P Connection Issues
1. **Connection Fails**: Try refreshing both pages and reconnecting
2. **NAT Problems**: Try different networks (home vs. public WiFi)
3. **Browser Issues**: Ensure both users are using supported browsers
4. **Firewall**: Corporate networks may block WebRTC connections

### Public Room Issues
1. **No Messages**: Ensure you're on the same browser and domain
2. **BroadcastChannel**: Some browsers may disable this in certain contexts
3. **Refresh**: Try refreshing both tabs if messages aren't syncing

### Profile Issues
1. **Lost Profile**: Check if localStorage is cleared or disabled
2. **Avatar Issues**: Ensure avatar URL is accessible and valid
3. **Name Not Showing**: Set your profile before sending messages

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main chat application
│   ├── layout.tsx            # App layout
│   └── globals.css           # 90s terminal styling
├── components/ui/            # shadcn/ui components
└── lib/                      # Utilities and configurations
```

## 🤝 Contributing

This is a demonstration project showcasing browser-native communication APIs. Feel free to:

1. **Report Issues**: File bug reports for browser compatibility problems
2. **Suggest Improvements**: Ideas for better UX or additional features
3. **Submit PRs**: Code improvements or bug fixes

## 📄 License

MIT License - Feel free to use this code for your own projects.

## 🔗 Related Technologies

- **BroadcastChannel API**: For same-origin communication
- **WebRTC DataChannels**: For peer-to-peer messaging
- **localStorage**: For profile persistence
- **Next.js 15**: Modern React framework
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: High-quality UI components

---

**Built with modern web technologies to demonstrate that complex applications can run entirely in the browser without any backend infrastructure.** 🚀