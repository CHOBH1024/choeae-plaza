import {createArtistVideoSearch} from '../_shared/youtube-search.js';
export const onRequestGet=createArtistVideoSearch({path:'/api/fancams',queries:{fancam:' 직캠'},defaultKind:'fancam',scope:()=> 'artist-fancam-search'});
