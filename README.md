# Masaood Ahamad — Developer Portfolio

A modern, high-performance interactive developer portfolio built with Vite, HTML5, CSS3, JavaScript, Lenis smooth scrolling, and a 240-frame interactive 3D canvas sequence.

---

## 🌟 Portfolio Overview

This portfolio showcases the software projects, technical skills, and continuous learning journey of **Masaood Ahamad**, a second-year B.Tech Computer Science student specializing in Data Structures & Algorithms (Java), Web Development, Machine Learning, and Deep Learning.

---

## 🛠️ Technologies Used

- **Frontend Core**: Vanilla HTML5, CSS3, Modern JavaScript (ES Modules)
- **Smooth Scrolling**: [Lenis](https://github.com/darkroomoff/lenis) for physics-based smooth scrolling
- **3D Interactive Animation**: HTML5 Canvas with 240-frame image sequence pre-decoding
- **Build Tool**: [Vite](https://vitejs.js.org/) for high-speed dev server and optimized static production builds
- **Typography**: Space Grotesk & Plus Jakarta Sans (Google Fonts)

---

## ✨ Main Features

- **Interactive 240-Frame 3D Scroll Canvas**: Seamless canvas image sequence mapped directly to scroll progress with DPR scaling and redraw optimization.
- **Physics-based Smooth Scroll**: Powered by Lenis for continuous scrolling dynamics.
- **Glassmorphism Design System**: Modern dark aesthetics with glass cards, vibrant orange accents, subtle hover states, and smooth transitions.
- **Responsive Layout**: Designed for mobile (320px+), tablet, laptop, and 4K desktop screens.
- **Centralized Data Model**: All portfolio content (personal details, projects, skills, education, and social links) is dynamically driven from `src/data/portfolio.js`.

---

## 📁 Project Structure

```text
portfolio-website/
├── index.html              # Main HTML entry point
├── package.json            # Project dependencies and scripts
├── vite.config.js          # Vite configuration (if applicable)
├── public/
│   └── frames/             # 240-frame 3D animation image sequence (ezgif-frame-001.jpg .. 240.jpg)
└── src/
    ├── style.css           # Core stylesheet & responsive design system
    ├── main.js             # Canvas render loop, Lenis scroll integration & DOM data hydration
    └── data/
        └── portfolio.js    # Centralized portfolio content configuration
```

---

## 🚀 How to Run Locally

### Prerequisites

Ensure you have **Node.js** (v16.0.0 or higher) installed on your system.

### Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Masaood001/portfolio-website.git
   cd portfolio-website
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

---

## 🔨 Build for Production

To create an optimized, minified production build:

```bash
npm run build
```

The output will be placed in the `dist/` directory, ready to be deployed to GitHub Pages, Vercel, Netlify, or any static web host.

---

## 📄 License

© 2026 Masaood Ahamad. All rights reserved.
