import {createArtistVideoSearch} from '../_shared/youtube-search.js';
import {artistQueryName,matchesArtistMetadata} from '../_shared/artist-video-relevance.js';
export const onRequestGet=createArtistVideoSearch({path:'/api/showcase',queries:{campaign:' 광고 CF',editorial:' 화보 메이킹'},defaultKind:'campaign',kindParameter:true,scope:kind=>'artist-'+kind+'-search',queryName:artistQueryName,acceptItem:matchesArtistMetadata,maxCandidates:24,cacheVersion:'artist-name-v3'});
