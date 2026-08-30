import fs from 'node:fs';

const completeProfileScreenPath = 'C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/screens/CompleteProfileScreen.tsx';
let screenCode = fs.readFileSync(completeProfileScreenPath, 'utf8');

if (!screenCode.includes("import profileService")) {
  screenCode = "import profileService from '../services/profileService';\n" + screenCode;
}

fs.writeFileSync(completeProfileScreenPath, screenCode, 'utf8');
console.log('Fixed profileService import in CompleteProfileScreen.tsx');
