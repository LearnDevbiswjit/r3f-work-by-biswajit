//tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
     "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    
  ],
  theme: {   
    extend: {          
       fontFamily: {
        aladin: ['Aladin', 'system-ui'],
        anton: ['Anton', 'system-ui'],
      },
      
    }, 
      container: {
      center: true,
    },
  },
  plugins: [],
}

