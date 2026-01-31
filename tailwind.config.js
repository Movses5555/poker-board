module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'custom-gray': 'rgba(208, 209, 211, 0.8)',
      },
      backgroundImage: {
        'custom-fold-gradient': 'radial-gradient(157.76% 50% at 50% 50%, #B6AA7D 0%, #7D6F3F 100%)',
        'custom-call-gradient': 'radial-gradient(73.26% 50% at 50% 50%, #80B44C 0%, #41693F 100%)',
        'custom-raise-gradient': 'radial-gradient(87.09% 50% at 50% 50%, #FF6E70 0%, #F04345 100%)',
        'custom-all-in-gradient': 'radial-gradient(84.13% 50% at 50% 50%, #C9505A 0%, #962029 100%)',
      },
      screens: {
        '5xl': '1920px',
        '8xl': '2560px',
      },
    },
  },
  plugins: [],
}
