import {createArtistVideoSearch} from '../_shared/youtube-search.js';
export const onRequestGet=createArtistVideoSearch({path:'/api/showcase',queries:{campaign:' 광고 CF',editorial:' 화보 메이킹'},defaultKind:'campaign',kindParameter:true,scope:kind=>'artist-'+kind+'-search'});
