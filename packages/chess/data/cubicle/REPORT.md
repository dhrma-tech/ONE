# Cubicle build report

Built 2026-11-24T12:49:29Z. Mode: **key-less**.
Videos: **185**, channels: **27**, nodes with videos: **51** of 149, latest items: **133**.

## Validator

```
note: published since 2021: 163/185 = 88% (unknown dates counted as not-since-2021: 22)
FAIL: only 185 videos (< 500)
FAIL: 98 empty nodes (of 149)
FAIL: section start: 8 < floor 40
FAIL: section tactics: 11 < floor 70
FAIL: section calc: 2 < floor 20
FAIL: section strategy: 4 < floor 60
FAIL: section open-e4: 2 < floor 20
FAIL: section open-d4: 6 < floor 20
FAIL: section open-flank: 2 < floor 20
FAIL: section def-e4: 14 < floor 20
FAIL: section def-d4: 3 < floor 20
FAIL: section gambits: 8 < floor 20
FAIL: section open-study: 6 < floor 20
FAIL: section middlegame: 4 < floor 20
FAIL: section endgames: 5 < floor 60
FAIL: section analysis: 27 < floor 50
FAIL: section gameplay: 19 < floor 50
FAIL: section improve: 7 < floor 40
FAIL: section speed: 0 < floor 20
FAIL: section legends: 0 < floor 20
FAIL: openings sections combined 41 < 140
INVALID (21 problems)
```

## Shortfalls

- YT_API_KEY not set: durations, languages, embeddable/public flags, likes and chapters are unknown (d is null, language is a title heuristic); the engagement bar is replaced by membership of the channel's long-form upload feed; upload feeds expose only the latest 15 videos per channel, so older evergreen videos are missing; named playlists cannot be searched by title.
- 7 trusted channels could not be resolved to a channel id from fetched evidence and were dropped: John Bartholomew, Aman Hambleton, Hanging Pawns, Chess Dojo, Remote Chess Academy, ChessBase India, Grand Chess Tour
- Playlists not expanded: Master Class Speedrun, Opening Theory Speedrun, Chess Fundamentals, Climbing the Rating Ladder, Building Habits
- Only 185 videos (< 500 required).
- Sections below floor: start 8/40, tactics 11/70, calc 2/20, strategy 4/60, open-e4 2/20, open-d4 6/20, open-flank 2/20, def-e4 14/20, def-d4 3/20, gambits 8/20, open-study 6/20, middlegame 4/20, endgames 5/60, analysis 27/50, gameplay 19/50, improve 7/40, speed 0/20, legends 0/20
- 98 taxonomy nodes have no videos.
- 22 videos have an unknown publish date (freshness 0.6, counted as not-since-2021 by the validator).

## Per section

| id | title | videos | floor |  |
|---|---|---|---|---|
| start | Start here | 8 | 40 | BELOW |
| tactics | Tactics | 11 | 70 | BELOW |
| calc | Calculation and thinking | 2 | 20 | BELOW |
| strategy | Strategy | 4 | 60 | BELOW |
| open-e4 | Openings as White: 1.e4 | 2 | 20 | BELOW |
| open-d4 | Openings as White: 1.d4 | 6 | 20 | BELOW |
| open-flank | Openings: flank and system | 2 | 20 | BELOW |
| def-e4 | Defences to 1.e4 | 14 | 20 | BELOW |
| def-d4 | Defences to 1.d4 | 3 | 20 | BELOW |
| gambits | Gambits and traps | 8 | 20 | BELOW |
| open-study | Opening study | 6 | 20 | BELOW |
| middlegame | Middlegame | 4 | 20 | BELOW |
| endgames | Endgames | 5 | 60 | BELOW |
| analysis | Game analysis | 27 | 50 | BELOW |
| gameplay | Gameplay | 19 | 50 | BELOW |
| news | Tournaments and news | 57 | 20 | ok |
| improve | Improve | 7 | 40 | BELOW |
| speed | Speed chess | 0 | 20 | BELOW |
| legends | Legends and stories | 0 | 20 | BELOW |

## Per node

| node | title | videos |
|---|---|---|
| start-board | Board and pieces | 0 |
| start-moves | How the pieces move | 0 |
| start-special | Castling, en passant, promotion | 0 |
| start-check | Check, checkmate, stalemate | 4 |
| start-notation | Notation | 0 |
| start-mates | Basic checkmates | 0 |
| start-opening | Opening principles | 0 |
| start-mistakes | Common beginner mistakes | 3 |
| start-zero | Learning chess from zero | 1 |
| tac-fork | Forks | 0 |
| tac-pin | Pins | 0 |
| tac-skewer | Skewers | 0 |
| tac-discovered | Discovered attacks | 0 |
| tac-deflection | Deflection and decoy | 0 |
| tac-defender | Removing the defender | 0 |
| tac-backrank | Back rank | 0 |
| tac-matepatterns | Mating patterns | 0 |
| tac-double | Double check | 0 |
| tac-zwischen | Zwischenzug | 0 |
| tac-trapped | Trapped pieces | 0 |
| tac-overload | Overloading | 0 |
| tac-perpetual | Perpetual and stalemate tricks | 0 |
| tac-sacs | Sacrifices | 3 |
| tac-drills | Pattern drills | 3 |
| tac-method | Puzzle method | 5 |
| calc-candidates | Candidate moves | 1 |
| calc-visual | Visualisation | 0 |
| calc-blindfold | Blindfold training | 0 |
| calc-process | Thinking process | 1 |
| calc-blunder | Blunder checks | 0 |
| calc-time | Time management | 0 |
| str-pawns | Pawn structure | 0 |
| str-outposts | Outposts and weak squares | 1 |
| str-files | Open files | 0 |
| str-activity | Piece activity | 0 |
| str-bvn | Bishop vs knight | 0 |
| str-goodbad | Good and bad bishop | 0 |
| str-space | Space and the center | 0 |
| str-prophy | Prophylaxis | 0 |
| str-imbalance | Imbalances | 1 |
| str-breaks | Pawn breaks | 0 |
| str-initiative | Initiative and tempo | 0 |
| str-convert | Converting an advantage | 0 |
| str-technique | Technique | 0 |
| str-defence | Defence | 2 |
| str-structures | Typical plans by structure | 0 |
| oe-italian | Italian Game | 0 |
| oe-ruy | Ruy Lopez | 1 |
| oe-scotch | Scotch Game | 0 |
| oe-vienna | Vienna Game | 0 |
| oe-kg | King's Gambit | 1 |
| oe-evans | Evans Gambit | 0 |
| oe-fourknights | Four Knights and others | 0 |
| od-london | London System | 3 |
| od-qg | Queen's Gambit | 0 |
| od-catalan | Catalan | 0 |
| od-colle | Colle System | 0 |
| od-tromp | Trompowsky | 3 |
| od-jobava | Jobava London | 0 |
| od-torre | Torre Attack | 0 |
| of-english | English Opening | 2 |
| of-reti | Reti Opening | 0 |
| of-bird | Bird Opening | 0 |
| of-kia | King's Indian Attack | 0 |
| de-najdorf | Sicilian: Najdorf | 1 |
| de-dragon | Sicilian: Dragon | 1 |
| de-sveshnikov | Sicilian: Sveshnikov | 0 |
| de-taimanov | Sicilian: Taimanov and Kan | 3 |
| de-alapin | Sicilian: Alapin | 0 |
| de-accdragon | Accelerated Dragon | 1 |
| de-sicilian | Sicilian: general | 2 |
| de-french | French Defence | 2 |
| de-caro | Caro-Kann | 3 |
| de-pirc | Pirc and Modern | 1 |
| de-scandi | Scandinavian | 0 |
| de-alekhine | Alekhine Defence | 0 |
| de-e5 | 1...e5 mainlines | 0 |
| dd-qgd | Queen's Gambit Declined | 0 |
| dd-slav | Slav | 0 |
| dd-semislav | Semi-Slav | 0 |
| dd-kid | King's Indian | 0 |
| dd-grunfeld | Grunfeld | 0 |
| dd-nimzo | Nimzo-Indian | 3 |
| dd-qid | Queen's Indian | 0 |
| dd-benoni | Benoni | 0 |
| dd-dutch | Dutch Defence | 0 |
| dd-benko | Benko Gambit | 0 |
| dd-budapest | Budapest Gambit | 0 |
| gam-danish | Danish Gambit | 0 |
| gam-morra | Smith-Morra Gambit | 3 |
| gam-englund | Englund Gambit | 0 |
| gam-stafford | Stafford Gambit | 1 |
| gam-bdg | Blackmar-Diemer Gambit | 0 |
| gam-latvian | Latvian and others | 4 |
| os-how | How to study openings | 1 |
| os-rep | Building a repertoire | 1 |
| os-trans | Transpositions | 0 |
| os-engine | Engines and databases | 4 |
| os-mistakes | Opening mistakes by rating | 0 |
| mg-attack | Attacking the king | 1 |
| mg-storm | Pawn storms | 3 |
| mg-oppcastle | Opposite-side castling | 0 |
| mg-defend | Defending | 0 |
| mg-plans | Plans and initiative | 0 |
| end-pawn | Pawn endings | 0 |
| end-rook | Rook endings | 0 |
| end-minor | Minor piece endings | 1 |
| end-queen | Queen endings | 1 |
| end-practical | Practical endgames | 3 |
| end-technical | Technical endgames | 0 |
| an-classic | Classic annotated games | 10 |
| an-engine | Engine-era top games | 9 |
| an-modern | Modern masterpieces | 8 |
| an-review | GM reviews of club games | 0 |
| an-guess | Guess the move and Elo | 0 |
| an-own | Reviewing your own games | 0 |
| gp-blitz | Blitz commentary | 1 |
| gp-rapid | Rapid commentary | 3 |
| gp-bullet | Bullet and speedruns | 7 |
| gp-stream | Titled streamers | 3 |
| gp-brilliancy | Brilliancy walkthroughs | 5 |
| gp-960 | Chess960 | 0 |
| nw-wch | World Championship | 20 |
| nw-cand | Candidates | 2 |
| nw-olympiad | Olympiad | 3 |
| nw-tata | Tata Steel | 0 |
| nw-norway | Norway Chess | 7 |
| nw-gct | Grand Chess Tour | 0 |
| nw-wc | World Cup and others | 25 |
| imp-b | Under 1000 | 0 |
| imp-i | 1000 to 1500 | 3 |
| imp-a | 1500 to 2000 | 4 |
| imp-x | 2000 and above | 0 |
| imp-plateau | Plateaus | 0 |
| imp-mind | Tilt and psychology | 0 |
| imp-time | Time management | 0 |
| imp-otb | OTB tournament prep | 0 |
| imp-online | Online vs OTB | 0 |
| imp-lichess | Lichess and engines | 0 |
| imp-plan | Study plans | 0 |
| sp-blitz | Blitz strategy | 0 |
| sp-bullet | Bullet strategy | 0 |
| sp-rapid | Rapid strategy | 0 |
| sp-pre | Premoves | 0 |
| sp-flag | Flagging and time scrambles | 0 |
| lg-docs | Player documentaries | 0 |
| lg-matches | Famous matches | 0 |
| lg-history | History | 0 |
| lg-interviews | Interviews | 0 |

## Level, kind

| level | videos |
|---|---|
| a | 50 |
| b | 18 |
| i | 116 |
| x | 1 |

| kind | videos |
|---|---|
| course | 2 |
| gameplay | 18 |
| lesson | 78 |
| recap | 58 |
| review | 27 |
| tips | 2 |

## Per channel

| channel | videos |
|---|---|
| kingscrusher | 18 |
| ChessNetwork | 18 |
| PowerPlayChess | 16 |
| Daniel Naroditsky | 15 |
| chessbrah | 15 |
| Eric Rosen | 15 |
| FIDE chess | 12 |
| agadmator's Chess Channel | 11 |
| Magnus Carlsen | 11 |
| Chess.com | 7 |
| Saint Louis Chess Club | 7 |
| Norway Chess | 7 |
| Lichess | 6 |
| Chessable | 6 |
| Anna Cramling | 6 |
| GothamChess | 4 |
| John Bartholomew | 1 |
| thechesswebsite | 1 |
| Bosnian Ape Society | 1 |
| Atland :D | 1 |
| Take Take Take | 1 |
| Yosha - Echecs | 1 |
| Derren Brown | 1 |
| Nic (J Bruce Feynman Niccolo P. Bentulan) | 1 |
| GMBenjaminFinegold | 1 |
| GMHikaru | 1 |
| BotezLive | 1 |

## Publish year

| year | videos |
|---|---|
| 2024 | 2 |
| 2025 | 16 |
| 2026 | 145 |
| unkn | 22 |

Oldest video: 2024-12-17 - Tactical Paths to 2000 | Smith-Morra, Nimzo, Alapin, London | GM Naroditsky's DYI Speedrun (Daniel Naroditsky)

## Vouch distribution (sr)

| independent vouches | videos |
|---|---|
| 0 | 163 |
| 2 | 22 |

## Gate

Candidates after oEmbed: 2186; kept: 278; oEmbed drops: {'restricted': 31, 'gone': 47}

| outcome | count |
|---|---|
| drop:insufficient-signal | 1119 |
| drop:no-feed-no-vouches | 655 |
| keep:tier-feed | 250 |
| drop:livestream-no-chapters | 73 |
| drop:clickbait | 44 |
| keep:vouches>=2 | 28 |
| drop:blocklist | 11 |
| drop:non-english | 5 |
| drop:shorts | 1 |

## Sources

| source | type | status | videos linked |
|---|---|---|---|
| GitHub list: hkirat/awesome-chess | github | ok | 6 |
| GitHub list: atamano/awesome-chess | github | ok | 0 |
| GitHub list: anubhavsrivastava/awesome-chess | github | ok | 0 |
| GitHub list: zach-garfinkel/Chessboard-Puzzle | github | ok | 1 |
| Lichess blog: 16 best chess YouTube channels | lichess | ok | 0 |
| Lichess blog: 11 best chess YouTube channels part 2 | lichess | ok | 1 |
| Lichess blog: chess YouTuber ranking 2025 | lichess | ok | 0 |
| Lichess forum: best chess youtuber for actual studying | lichess | ok | 0 |
| Lichess forum: what youtube channel for learning | lichess | ok | 0 |
| Lichess forum: recommend a youtube chess channel | lichess | ok | 0 |
| Lichess forum: best place to learn chess from | lichess | ok | 0 |
| Lichess forum: chess website for a beginner | lichess | ok | 0 |
| Lichess video library | lichess | ok | 2505 |
| The Daily Star: YouTube channels for your chess journey | web | ok | 0 |
| Beacons: top chess youtubers | web | ok | 0 |
| Chessable blog | web | ok | 0 |
| Hacker News (Algolia API) | hn | ok | 309 |
| Wikipedia chess articles (MediaWiki API) | wikipedia | ok | 117 |

## Channels resolved

| channel | tier | id | evidence |
|---|---|---|---|
| Daniel Naroditsky | 1 | UCHP9CdeguNUI-_nBv_UXBhw | wikidata:Q5218240 |
| Ben Finegold | 1 | UC6EnFbK-P5q0zeaqI5yobKg | wikipedia:Ben Finegold |
| PowerPlay Chess (Daniel King) | 1 | UCMBATpFb--uLNAODOVWvCTA | rss-user:PowerPlayChess |
| GothamChess | 2 | UCQHX6ViZmPsWiYSFAyS0a3Q | wikidata:Q27530896 |
| agadmator | 2 | UCL5YbN5WLFD8dLIegT5QAbA | wikidata:Q68486725 |
| Chess.com | 2 | UC5kS0l76kC0xOzMPtOmSFGw | wikidata:Q16829376 |
| Lichess | 2 | UCr6RfQga70yMM9-nuzAYTsA | wikidata:Q19831807 |
| Saint Louis Chess Club | 2 | UCM-ONC2bCHytG2mYtKDmIeA | wikidata:Q17084738 |
| Hikaru (GMHikaru) | 2 | UCweCc7bSMX5J4jEH7HFImng | wikidata:Q337223 |
| Eric Rosen | 2 | UCXy10-NEFGxQ3b4NVrzHw1Q | wikidata:Q27530857 |
| ChessNetwork | 2 | UCCDOQrpqLqKVcTCKzqarxLg | rss-user:ChessNetwork |
| Chessbrah | 2 | UCvXxdkt1d8Uu08NAQP2IUTw | rss-user:chessbrah |
| Anna Cramling | 2 | UCOVfq3NNYjlYCz1iou69FwQ | wikidata:Q104539456 |
| Magnus Carlsen | 2 | UCbdcpQ5uPPymv7Ea0nnFfOw | wikidata:Q106807 |
| Chessable | 2 | UCxVGiP4dl19wwGJlCy3_u8g | source:Chessable blog |
| Kingscrusher | 2 | UCDUDDmslypVXYoUsZafHSUQ | source:Lichess forum: recommend a youtube chess channel |
| chess24 | 2 | UCp-0glYRgyP-7NslPCs65pA | rss-user:chess24 |
| BotezLive | 2 | UCAn8NrZ-J4CRfwodajqFYoQ | wikipedia:Alexandra Botez |
| FIDE | 2 | UC9B47GnzCRFHTT1BIBWvStQ | wikidata:Q102178 |
| Tata Steel Chess | 2 | UClqa8ak-g_8qQkqRZ8ImaSw | rss-user:TataSteelChess |
| Norway Chess | 2 | UCX_tAmRRY4yniFKRMZ4h1hg | rss-user:NorwayChess |

## Channels / playlists NOT resolved (dropped)

| name | tier | reason |
|---|---|---|
| John Bartholomew | 1 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| Aman Hambleton | 1 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| Hanging Pawns | 1 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| Chess Dojo | 1 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| Remote Chess Academy | 1 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| ChessBase India | 2 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| Grand Chess Tour | 2 | UCFh6FCMsTdnfEA_N7rdIBnw (source:GitHub list: anubhavsrivastava/awesome-chess) is 'Chess Traps'; UCDUDDmslypVXYoUsZafHSUQ (source:Lichess fo |
| playlist: Master Class Speedrun | 1 | no playlist id in any fetched source; key-less cannot search by title |
| playlist: Opening Theory Speedrun | 1 | no playlist id in any fetched source; key-less cannot search by title |
| playlist: Chess Fundamentals | 1 | no playlist id in any fetched source; key-less cannot search by title |
| playlist: Climbing the Rating Ladder | 1 | no playlist id in any fetched source; key-less cannot search by title |
| playlist: Building Habits | 1 | no playlist id in any fetched source; key-less cannot search by title |

## Notes

- Freshness for an unknown publish date is 0.6 (no recency bonus, never flagged outdated).
- Key-less engagement for scoring = percentile of RSS view counts within the channel; no like data.
- The 'outdated' flag only applies to non-evergreen nodes with freshness < 0.4.
