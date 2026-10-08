import 'dotenv/config';
import { parseMealPlanMessage } from '../src/ai/parser.js';

const msg = `* Ryžové krekry (2 balenia) – **1,20 €**
  * Kukuričné krekry (2 balenia) – **1,20 €**
  * Ryža dlhozrnná (1 kg) – **1,50 €**
  * Ovsené vločky (1 kg) – **1,10 €**
  * Červená šošovica (500 g) + Fazuľa suchá (500 g) – **2,20 €**
  * Slnečnicové semienka (100 g) + Vlašské orechy (100 g) – **2,20 €**
  * mlieko plnotučné, 1ks, čerstvé`;

const result = await parseMealPlanMessage(msg, []);
console.log(JSON.stringify(result, null, 2));
console.log(`\nTotal extras: ${result.extras.length}`);
