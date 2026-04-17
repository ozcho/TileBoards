import imgPlus1 from '../../tokens/plus1.png';
import imgZero from '../../tokens/zero.png';
import imgMinus1 from '../../tokens/minus1.png';
import imgMinus2 from '../../tokens/minus2.png';
import imgMinus3 from '../../tokens/minus3.png';
import imgMinus4 from '../../tokens/minus4.png';
import imgMinus5 from '../../tokens/minus5.png';
import imgMinus6 from '../../tokens/minus6.png';
import imgMinus7 from '../../tokens/minus7.png';
import imgMinus8 from '../../tokens/minus8.png';
import imgSkull from '../../tokens/skull.png';
import imgCultist from '../../tokens/cultist.png';
import imgTablet from '../../tokens/tablet.png';
import imgElderThing from '../../tokens/elder_thing.png';
import imgTentacle from '../../tokens/tentacle.png';
import imgElderStar from '../../tokens/elder_star.png';
import imgBless from '../../tokens/bless.png';
import imgCurse from '../../tokens/curse.png';
import imgFrost from '../../tokens/frost.png';

const TOKEN_IMAGES = {
  '+1': imgPlus1,
  '0': imgZero,
  '-1': imgMinus1,
  '-2': imgMinus2,
  '-3': imgMinus3,
  '-4': imgMinus4,
  '-5': imgMinus5,
  '-6': imgMinus6,
  '-7': imgMinus7,
  '-8': imgMinus8,
  skull: imgSkull,
  cultist: imgCultist,
  tablet: imgTablet,
  elder_thing: imgElderThing,
  tentacle: imgTentacle,
  elder_star: imgElderStar,
  bless: imgBless,
  curse: imgCurse,
  frost: imgFrost,
};

const TokenIcon = ({ token, size = 24 }) => {
  const src = TOKEN_IMAGES[token];
  if (!src) return <span>{token}</span>;
  return <img src={src} alt={token} width={size} height={size} className="token-icon-img" />;
};

export default TokenIcon;
