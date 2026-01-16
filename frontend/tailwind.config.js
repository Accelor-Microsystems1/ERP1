/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], // Adjust if needed
    theme: {
      extend: {
        fontFamily: {
            poppins: ["Poppins", "sans-serif"],
          },
      },
    },
    plugins: [require("tailwind-scrollbar")], // Add scrollbar plugin here
  };
  