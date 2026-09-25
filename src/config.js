module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || '',
  cacheTtlMinutes: parseInt(process.env.CACHE_TTL_MINUTES || '60', 10),
  docs: {
    prerequisitos: {
      url: 'https://docs.google.com/document/d/1UOeZP__964ilyudaM-xSEciND2t67SRT8RzmqOHtfGQ/export?format=txt',
    },
    grade: {
      url: 'https://docs.google.com/spreadsheets/d/1b9-li0kiJsKcyvy-v0fnYQlu2PoKd30BYZDBfFLLKC4/export?format=csv&gid=46916154',
    },
    polos: {
      url: 'https://docs.google.com/spreadsheets/d/1BIx3G2pQcj7kb59mF6_GvHBO39J9LmafaCsm-UcjGD4/export?format=csv&gid=965748408',
    },
  },
};
