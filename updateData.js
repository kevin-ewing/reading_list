const fs = require("fs").promises;
const path = require("path");
const pdfParse = require("pdf-parse");
const seedrandom = require("seedrandom");

const booksDir = "./books";
const averageReadingSpeed = 200; // words per minute

const formatTitle = (filename) =>
  filename
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const parseCreationDate = (dateString) => {
  if (!dateString || !dateString.startsWith("D:")) {
    return "Unknown";
  }

  const year = dateString.substring(2, 6);
  const month = dateString.substring(6, 8);
  const day = dateString.substring(8, 10);

  return `${month}/${day}/${year}`;
};

const estimateDifficulty = (text) => {
  const totalWords = text.split(" ").length;
  const difficultWordsCount = text
    .split(" ")
    .filter((word) => word.length > 7).length;
  const difficultWordRatio = (difficultWordsCount / totalWords) * 100;

  // You can adjust these thresholds based on more testing and what you see fits your selection of books.
  if (difficultWordRatio < 15) {
    return "Easy";
  } else if (difficultWordRatio >= 15 && difficultWordRatio < 30) {
    return "Medium";
  } else if (difficultWordRatio >= 30 && difficultWordRatio < 50) {
    return "Hard";
  } else {
    return "Very Hard";
  }
};

const calculateReadTime = (numWords) => {
  const minutes = numWords / averageReadingSpeed;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  let readTimeEnglish = "";
  if (hours > 0) {
    readTimeEnglish += `${hours} ${hours > 1 ? "hours" : "hour"}`;
  }
  if (remainingMinutes > 0) {
    if (hours > 0) {
      readTimeEnglish += " and ";
    }
    readTimeEnglish += `${remainingMinutes} ${
      remainingMinutes > 1 ? "minutes" : "minute"
    }`;
  }
  return readTimeEnglish || "Less than a minute";
};

const generateRating = (title) => {
  // A simple hashing function to convert the title to a numeric seed
  let seed = 0;
  for (let i = 0; i < title.length; i++) {
    seed = (seed << 5) - seed + title.charCodeAt(i);
    seed |= 0; // Convert to 32bit integer
  }

  // Initialize the seeded random number generator
  const rng = seedrandom(seed);

  // Generate a random number between 7 (inclusive) and 10 (exclusive)
  const rating = 7 + rng() * 3;

  // Round to one decimal place
  return Math.round(rating * 2) / 2;
};

const generateSignature = (title) => {
  let seed = 0;
  for (let i = 0; i < title.length; i++) {
    seed = (seed << 5) - seed + title.charCodeAt(i);
    seed |= 0; // Convert to 32bit integer
  }

  // Use the parity of the seed to assign a signature
  return seed % 2 === 0 ? "RE" : "JE";
};

const extractPDFData = async (pdfPath) => {
  try {
    const pdfBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(pdfBuffer);
    const numPages = data.numpages;
    const author = data.info.Author || "Unknown";
    const creationDateRaw = data.info.CreationDate || "Unknown";
    const creationDate = parseCreationDate(creationDateRaw);
    const text = data.text || "";
    const readTime = calculateReadTime(text.split(" ").length);
    const difficulty = estimateDifficulty(text);

    return { numPages, author, creationDate, readTime, difficulty };
  } catch (error) {
    console.error(`Error processing ${pdfPath}: `, error);
    return {
      numPages: null,
      author: "Unknown",
      creationDate: "Unknown",
      readTime: null,
      difficulty: null,
    };
  }
};

const processBooksDirectory = async () => {
  try {
    const files = await fs.readdir(booksDir);
    const booksData = [];

    for (const file of files) {
      if (path.extname(file).toLowerCase() === ".pdf") {
        const filePath = path.join(booksDir, file);
        const { numPages, author, creationDate, readTime, difficulty } =
          await extractPDFData(filePath);
        const title = formatTitle(path.basename(file, ".pdf"));
        const rating = generateRating(title); // Generate the rating based on the title
        const signature = generateSignature(title);
        booksData.push({
          title,
          author,
          numPages,
          creationDate,
          readTime,
          difficulty,
          rating,
          signature,
        });
      }
    }

    await fs.writeFile(
      "./booksData.json",
      JSON.stringify(booksData, null, 2),
      "utf8"
    );
    console.log("Books data has been written to booksData.json");
  } catch (err) {
    console.error("Error processing the books directory:", err);
  }
};

processBooksDirectory();
