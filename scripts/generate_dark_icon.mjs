import sharp from 'sharp';
import path from 'path';

const input = path.resolve('assets/icons8-anki-light-22.png');
const output = path.resolve('assets/icons8-anki-dark-22.png');

sharp(input)
  .negate({ alpha: false })
  .toFile(output)
  .then(() => console.log('Light icon generated:', output))
  .catch(err => console.error(err));
  