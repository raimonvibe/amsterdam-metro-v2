/** Real station list and line network (snapshot of the GVB metro, generated
 *  from the backend's subset) so tests exercise the names users really type. */
import { Station } from "../types";
import { NetworkLine } from "../travel/types";

export const STATIONS: Station[] = [
  {
    "id": "3980326",
    "name": "Amsterdam, Amstelstation",
    "latitude": 52.34652,
    "longitude": 4.91747,
    "lines": [
      "51",
      "53",
      "54"
    ]
  },
  {
    "id": "3980314",
    "name": "Amsterdam, Amstelveenseweg",
    "latitude": 52.33841,
    "longitude": 4.85764,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3980563",
    "name": "Amsterdam, Bullewijk",
    "latitude": 52.30667,
    "longitude": 4.9522,
    "lines": [
      "50",
      "54"
    ]
  },
  {
    "id": "3979836",
    "name": "Amsterdam, Burg. De Vlugtlaan",
    "latitude": 52.37973,
    "longitude": 4.83827,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3979722",
    "name": "Amsterdam, Centraal Station",
    "latitude": 52.37776,
    "longitude": 4.90036,
    "lines": [
      "51",
      "52",
      "53",
      "54"
    ]
  },
  {
    "id": "3980395",
    "name": "Amsterdam, De Pijp",
    "latitude": 52.35315,
    "longitude": 4.89104,
    "lines": [
      "52"
    ]
  },
  {
    "id": "3979735",
    "name": "Amsterdam, Europaplein",
    "latitude": 52.34157,
    "longitude": 4.89157,
    "lines": [
      "52"
    ]
  },
  {
    "id": "3980228",
    "name": "Amsterdam, Gaasperplas",
    "latitude": 52.31101,
    "longitude": 4.98459,
    "lines": [
      "53"
    ]
  },
  {
    "id": "3979808",
    "name": "Amsterdam, Ganzenhoef",
    "latitude": 52.32365,
    "longitude": 4.97304,
    "lines": [
      "53"
    ]
  },
  {
    "id": "3980550",
    "name": "Amsterdam, Gein",
    "latitude": 52.29634,
    "longitude": 4.9886,
    "lines": [
      "50",
      "54"
    ]
  },
  {
    "id": "3981073",
    "name": "Amsterdam, Heemstedestraat",
    "latitude": 52.35282,
    "longitude": 4.83428,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3979743",
    "name": "Amsterdam, Henk Sneevlietweg",
    "latitude": 52.3465,
    "longitude": 4.83451,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3980939",
    "name": "Amsterdam, Isolatorweg",
    "latitude": 52.39517,
    "longitude": 4.85059,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3980089",
    "name": "Amsterdam, Jan van Galenstraat",
    "latitude": 52.37222,
    "longitude": 4.83512,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3979765",
    "name": "Amsterdam, Kraaiennest",
    "latitude": 52.31657,
    "longitude": 4.9795,
    "lines": [
      "53"
    ]
  },
  {
    "id": "3980811",
    "name": "Amsterdam, Nieuwmarkt",
    "latitude": 52.37193,
    "longitude": 4.90133,
    "lines": [
      "51",
      "53",
      "54"
    ]
  },
  {
    "id": "3979688",
    "name": "Amsterdam, Noord",
    "latitude": 52.40154,
    "longitude": 4.9318,
    "lines": [
      "52"
    ]
  },
  {
    "id": "3979933",
    "name": "Amsterdam, Noorderpark",
    "latitude": 52.38901,
    "longitude": 4.91882,
    "lines": [
      "52"
    ]
  },
  {
    "id": "3979776",
    "name": "Amsterdam, Overamstel",
    "latitude": 52.33167,
    "longitude": 4.91754,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3980167",
    "name": "Amsterdam, Postjesweg",
    "latitude": 52.36486,
    "longitude": 4.83392,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3979741",
    "name": "Amsterdam, Reigersbos",
    "latitude": 52.29562,
    "longitude": 4.97418,
    "lines": [
      "50",
      "54"
    ]
  },
  {
    "id": "3980118",
    "name": "Amsterdam, Rokin",
    "latitude": 52.36951,
    "longitude": 4.89245,
    "lines": [
      "52"
    ]
  },
  {
    "id": "3980158",
    "name": "Amsterdam, Spaklerweg",
    "latitude": 52.34005,
    "longitude": 4.92096,
    "lines": [
      "51",
      "53",
      "54"
    ]
  },
  {
    "id": "3980962",
    "name": "Amsterdam, Station Bijlmer ArenA",
    "latitude": 52.31227,
    "longitude": 4.94703,
    "lines": [
      "50",
      "54"
    ]
  },
  {
    "id": "3980442",
    "name": "Amsterdam, Station Holendrecht",
    "latitude": 52.2981,
    "longitude": 4.96004,
    "lines": [
      "50",
      "54"
    ]
  },
  {
    "id": "3980624",
    "name": "Amsterdam, Station Lelylaan",
    "latitude": 52.35791,
    "longitude": 4.83436,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3980950",
    "name": "Amsterdam, Station RAI",
    "latitude": 52.33764,
    "longitude": 4.88951,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3980688",
    "name": "Amsterdam, Station Sloterdijk",
    "latitude": 52.38908,
    "longitude": 4.83887,
    "lines": [
      "50",
      "51"
    ]
  },
  {
    "id": "3979717",
    "name": "Amsterdam, Station Zuid",
    "latitude": 52.3392,
    "longitude": 4.87423,
    "lines": [
      "50",
      "51",
      "52"
    ]
  },
  {
    "id": "3980848",
    "name": "Amsterdam, Strandvliet",
    "latitude": 52.31847,
    "longitude": 4.94145,
    "lines": [
      "50",
      "54"
    ]
  },
  {
    "id": "3980501",
    "name": "Amsterdam, Van der Madeweg",
    "latitude": 52.32966,
    "longitude": 4.93032,
    "lines": [
      "50",
      "53",
      "54"
    ]
  },
  {
    "id": "3980042",
    "name": "Amsterdam, Venserpolder",
    "latitude": 52.32676,
    "longitude": 4.94635,
    "lines": [
      "53"
    ]
  },
  {
    "id": "3979710",
    "name": "Amsterdam, Vijzelgracht",
    "latitude": 52.36005,
    "longitude": 4.89086,
    "lines": [
      "52"
    ]
  },
  {
    "id": "3979944",
    "name": "Amsterdam, Waterlooplein",
    "latitude": 52.36696,
    "longitude": 4.90309,
    "lines": [
      "51",
      "53",
      "54"
    ]
  },
  {
    "id": "3979696",
    "name": "Amsterdam, Weesperplein",
    "latitude": 52.36122,
    "longitude": 4.9079,
    "lines": [
      "51",
      "53",
      "54"
    ]
  },
  {
    "id": "3980265",
    "name": "Amsterdam, Wibautstraat",
    "latitude": 52.35431,
    "longitude": 4.91207,
    "lines": [
      "51",
      "53",
      "54"
    ]
  },
  {
    "id": "3980840",
    "name": "Diemen, Station Diemen Zuid",
    "latitude": 52.33032,
    "longitude": 4.95662,
    "lines": [
      "53"
    ]
  },
  {
    "id": "3980003",
    "name": "Diemen, Verrijn Stuartweg",
    "latitude": 52.32863,
    "longitude": 4.96674,
    "lines": [
      "53"
    ]
  },
  {
    "id": "3979812",
    "name": "Duivendrecht, Station Duivendrecht",
    "latitude": 52.32357,
    "longitude": 4.93652,
    "lines": [
      "50",
      "54"
    ]
  }
];

export const NETWORK: NetworkLine[] = [
  {
    "id": "50",
    "name": "Gein - Isolatorweg",
    "color": "#3CB44B",
    "directions": [
      {
        "headsign": "Gein",
        "stations": [
          "Amsterdam, Isolatorweg",
          "Amsterdam, Station Sloterdijk",
          "Amsterdam, Burg. De Vlugtlaan",
          "Amsterdam, Jan van Galenstraat",
          "Amsterdam, Postjesweg",
          "Amsterdam, Station Lelylaan",
          "Amsterdam, Heemstedestraat",
          "Amsterdam, Henk Sneevlietweg",
          "Amsterdam, Amstelveenseweg",
          "Amsterdam, Station Zuid",
          "Amsterdam, Station RAI",
          "Amsterdam, Overamstel",
          "Amsterdam, Van der Madeweg",
          "Duivendrecht, Station Duivendrecht",
          "Amsterdam, Strandvliet",
          "Amsterdam, Station Bijlmer ArenA",
          "Amsterdam, Bullewijk",
          "Amsterdam, Station Holendrecht",
          "Amsterdam, Reigersbos",
          "Amsterdam, Gein"
        ],
        "runtimes_s": [
          115,
          85,
          75,
          72,
          72,
          55,
          66,
          156,
          95,
          93,
          164,
          95,
          75,
          64,
          77,
          62,
          88,
          97,
          121
        ]
      },
      {
        "headsign": "Isolatorweg",
        "stations": [
          "Amsterdam, Gein",
          "Amsterdam, Reigersbos",
          "Amsterdam, Station Holendrecht",
          "Amsterdam, Bullewijk",
          "Amsterdam, Station Bijlmer ArenA",
          "Amsterdam, Strandvliet",
          "Duivendrecht, Station Duivendrecht",
          "Amsterdam, Van der Madeweg",
          "Amsterdam, Overamstel",
          "Amsterdam, Station RAI",
          "Amsterdam, Station Zuid",
          "Amsterdam, Amstelveenseweg",
          "Amsterdam, Henk Sneevlietweg",
          "Amsterdam, Heemstedestraat",
          "Amsterdam, Station Lelylaan",
          "Amsterdam, Postjesweg",
          "Amsterdam, Jan van Galenstraat",
          "Amsterdam, Burg. De Vlugtlaan",
          "Amsterdam, Station Sloterdijk",
          "Amsterdam, Isolatorweg"
        ],
        "runtimes_s": [
          109,
          98,
          88,
          62,
          77,
          58,
          78,
          99,
          153,
          94,
          87,
          155,
          66,
          57,
          72,
          69,
          72,
          82,
          120
        ]
      }
    ]
  },
  {
    "id": "51",
    "name": "Centraal Station - Isolatorweg",
    "color": "#F58231",
    "directions": [
      {
        "headsign": "Centraal Station",
        "stations": [
          "Amsterdam, Isolatorweg",
          "Amsterdam, Station Sloterdijk",
          "Amsterdam, Burg. De Vlugtlaan",
          "Amsterdam, Jan van Galenstraat",
          "Amsterdam, Postjesweg",
          "Amsterdam, Station Lelylaan",
          "Amsterdam, Heemstedestraat",
          "Amsterdam, Henk Sneevlietweg",
          "Amsterdam, Amstelveenseweg",
          "Amsterdam, Station Zuid",
          "Amsterdam, Station RAI",
          "Amsterdam, Overamstel",
          "Amsterdam, Spaklerweg",
          "Amsterdam, Amstelstation",
          "Amsterdam, Wibautstraat",
          "Amsterdam, Weesperplein",
          "Amsterdam, Waterlooplein",
          "Amsterdam, Nieuwmarkt",
          "Amsterdam, Centraal Station"
        ],
        "runtimes_s": [
          115,
          85,
          75,
          72,
          72,
          55,
          66,
          156,
          95,
          93,
          164,
          97,
          64,
          83,
          76,
          65,
          58,
          98
        ]
      },
      {
        "headsign": "Isolatorweg",
        "stations": [
          "Amsterdam, Centraal Station",
          "Amsterdam, Nieuwmarkt",
          "Amsterdam, Waterlooplein",
          "Amsterdam, Weesperplein",
          "Amsterdam, Wibautstraat",
          "Amsterdam, Amstelstation",
          "Amsterdam, Spaklerweg",
          "Amsterdam, Overamstel",
          "Amsterdam, Station RAI",
          "Amsterdam, Station Zuid",
          "Amsterdam, Amstelveenseweg",
          "Amsterdam, Henk Sneevlietweg",
          "Amsterdam, Heemstedestraat",
          "Amsterdam, Station Lelylaan",
          "Amsterdam, Postjesweg",
          "Amsterdam, Jan van Galenstraat",
          "Amsterdam, Burg. De Vlugtlaan",
          "Amsterdam, Station Sloterdijk",
          "Amsterdam, Isolatorweg"
        ],
        "runtimes_s": [
          86,
          58,
          64,
          73,
          80,
          66,
          98,
          153,
          94,
          87,
          155,
          66,
          57,
          72,
          69,
          72,
          82,
          120
        ]
      }
    ]
  },
  {
    "id": "52",
    "name": "Noord - Zuid",
    "color": "#4363D8",
    "directions": [
      {
        "headsign": "Noord",
        "stations": [
          "Amsterdam, Station Zuid",
          "Amsterdam, Europaplein",
          "Amsterdam, De Pijp",
          "Amsterdam, Vijzelgracht",
          "Amsterdam, Rokin",
          "Amsterdam, Centraal Station",
          "Amsterdam, Noorderpark",
          "Amsterdam, Noord"
        ],
        "runtimes_s": [
          123,
          102,
          72,
          93,
          85,
          106,
          121
        ]
      },
      {
        "headsign": "Zuid",
        "stations": [
          "Amsterdam, Noord",
          "Amsterdam, Noorderpark",
          "Amsterdam, Centraal Station",
          "Amsterdam, Rokin",
          "Amsterdam, Vijzelgracht",
          "Amsterdam, De Pijp",
          "Amsterdam, Europaplein",
          "Amsterdam, Station Zuid"
        ],
        "runtimes_s": [
          116,
          107,
          86,
          93,
          67,
          100,
          138
        ]
      }
    ]
  },
  {
    "id": "53",
    "name": "Centraal Station - Gaasperplas",
    "color": "#E6194B",
    "directions": [
      {
        "headsign": "Centraal Station",
        "stations": [
          "Amsterdam, Gaasperplas",
          "Amsterdam, Kraaiennest",
          "Amsterdam, Ganzenhoef",
          "Diemen, Verrijn Stuartweg",
          "Diemen, Station Diemen Zuid",
          "Amsterdam, Venserpolder",
          "Amsterdam, Van der Madeweg",
          "Amsterdam, Spaklerweg",
          "Amsterdam, Amstelstation",
          "Amsterdam, Wibautstraat",
          "Amsterdam, Weesperplein",
          "Amsterdam, Waterlooplein",
          "Amsterdam, Nieuwmarkt",
          "Amsterdam, Centraal Station"
        ],
        "runtimes_s": [
          69,
          77,
          61,
          76,
          68,
          118,
          104,
          64,
          83,
          76,
          65,
          58,
          98
        ]
      },
      {
        "headsign": "Gaasperplas",
        "stations": [
          "Amsterdam, Centraal Station",
          "Amsterdam, Nieuwmarkt",
          "Amsterdam, Waterlooplein",
          "Amsterdam, Weesperplein",
          "Amsterdam, Wibautstraat",
          "Amsterdam, Amstelstation",
          "Amsterdam, Spaklerweg",
          "Amsterdam, Van der Madeweg",
          "Amsterdam, Venserpolder",
          "Diemen, Station Diemen Zuid",
          "Diemen, Verrijn Stuartweg",
          "Amsterdam, Ganzenhoef",
          "Amsterdam, Kraaiennest",
          "Amsterdam, Gaasperplas"
        ],
        "runtimes_s": [
          86,
          58,
          64,
          73,
          80,
          66,
          104,
          123,
          71,
          74,
          63,
          77,
          92
        ]
      }
    ]
  },
  {
    "id": "54",
    "name": "Centraal Station - Gein",
    "color": "#FFE119",
    "directions": [
      {
        "headsign": "Centraal Station",
        "stations": [
          "Amsterdam, Gein",
          "Amsterdam, Reigersbos",
          "Amsterdam, Station Holendrecht",
          "Amsterdam, Bullewijk",
          "Amsterdam, Station Bijlmer ArenA",
          "Amsterdam, Strandvliet",
          "Duivendrecht, Station Duivendrecht",
          "Amsterdam, Van der Madeweg",
          "Amsterdam, Spaklerweg",
          "Amsterdam, Amstelstation",
          "Amsterdam, Wibautstraat",
          "Amsterdam, Weesperplein",
          "Amsterdam, Waterlooplein",
          "Amsterdam, Nieuwmarkt",
          "Amsterdam, Centraal Station"
        ],
        "runtimes_s": [
          109,
          98,
          88,
          62,
          77,
          58,
          78,
          104,
          64,
          83,
          76,
          65,
          58,
          98
        ]
      },
      {
        "headsign": "Gein",
        "stations": [
          "Amsterdam, Centraal Station",
          "Amsterdam, Nieuwmarkt",
          "Amsterdam, Waterlooplein",
          "Amsterdam, Weesperplein",
          "Amsterdam, Wibautstraat",
          "Amsterdam, Amstelstation",
          "Amsterdam, Spaklerweg",
          "Amsterdam, Van der Madeweg",
          "Duivendrecht, Station Duivendrecht",
          "Amsterdam, Strandvliet",
          "Amsterdam, Station Bijlmer ArenA",
          "Amsterdam, Bullewijk",
          "Amsterdam, Station Holendrecht",
          "Amsterdam, Reigersbos",
          "Amsterdam, Gein"
        ],
        "runtimes_s": [
          86,
          58,
          64,
          73,
          80,
          66,
          104,
          75,
          64,
          77,
          62,
          88,
          97,
          91
        ]
      }
    ]
  }
];
