import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

try {

    const model = genAI.getGenerativeModel({
        model: "models/gemini-2.0-flash"
    });

    const result = await model.generateContent("Halo");

    console.log(result.response.text());

} catch (err) {

    console.error(err);

}