export interface SCUser {
  id: number;
  urn: string;
  username: string;
  full_name: string;
  avatar_url: string;
  city: string;
  country_code: string;
  description: string;
  followers_count: number;
  followings_count: number;
  track_count: number;
  playlist_count: number;
  permalink_url: string;
}

export interface SCTrack {
  id: number;
  urn: string;
  title: string;
  permalink_url: string;
  duration: number; // ms
  artwork_url: string | null;
  waveform_url: string;
  stream_url: string;
  user: SCUser;
  playback_count: number;
  likes_count: number;
  comment_count: number;
  genre: string;
  tag_list: string;
  created_at: string;
  streamable: boolean;
  access: string;
  publisher_metadata?: {
    artist?: string;
    release_title?: string;
    album_title?: string;
    writer_composer?: string;
  };
  media: {
    transcodings: SCTranscoding[];
  };
}

export interface SCTranscoding {
  url: string;
  preset: string;
  duration: number;
  snipped: boolean;
  format: {
    protocol: string;
    mime_type: string;
  };
  quality: string;
}

export interface SCPlaylist {
  id: number;
  urn: string;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  duration: number;
  track_count: number;
  user: SCUser;
  tracks: SCTrack[];
  created_at: string;
  description: string;
}

export interface SCSearchResult<T> {
  collection: T[];
  total_results: number;
  next_href: string | null;
  query_urn: string;
}
