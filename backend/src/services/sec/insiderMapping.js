// Insider → Company overrides for ambiguous relationships
// Format: key is lowercase "executive full name", value has ticker & company.
const knownExecutives = {
  'lagarde michel': { ticker: 'VRTX', company: 'Vertex Pharmaceuticals' },
  'pomel olivier': { ticker: 'DDOG', company: 'Datadog' },
  'bieling laura': { ticker: 'AGO', company: 'Assured Guaranty' },
  'borges francisco': { ticker: 'CSCO', company: 'Cisco Systems' },
  'taylor bernadette': { ticker: 'FULTP', company: 'Fulton Financial' },
  'wenger philip': { ticker: 'FULTP', company: 'Fulton Financial' },
  'shipp earl': { ticker: 'OLN', company: 'Olin Corp' },
  'higgins john': { ticker: 'TECH', company: 'Bio-Techne' },
  'stewart shelley': { ticker: 'KTB', company: 'Kontoor Brands' },
  'hudson dawn': { ticker: 'IPG', company: 'Interpublic Group' },
  'lauderback brenda': { ticker: 'WWW', company: 'Wolverine World Wide' },
  'price demonty': { ticker: 'WWW', company: 'Wolverine World Wide' },
  'bartee johanna': { ticker: 'NNBR', company: 'NN Inc' },
  'walker neal': { ticker: 'ACRS', company: 'Aclaris Therapeutics' },
  'parker craig': { ticker: 'SRZNW', company: 'Surrozen' },
  'flees lori': { ticker: 'NNBR', company: 'NN Inc' },
  'sussman joel': { ticker: 'GRTX', company: 'Galera Therapeutics' },
  'wilson-thompson kathleen': { ticker: 'WWW', company: 'Wolverine World Wide' },
  'keeney adam': { ticker: 'BIIB', company: 'Biogen' },
  'socci elizabeth': { ticker: 'CRS', company: 'Carpenter Technology' },
  'garber alan': { ticker: 'VRTX', company: 'Vertex Pharmaceuticals' },
  'agarwal amit': { ticker: 'DDOG', company: 'Datadog' },
  'sorensen mel': { ticker: 'DDOG', company: 'Datadog' },
  'hendricks william': { ticker: 'PTEN', company: 'Patterson-UTI Energy' },
  'royce charles': { ticker: 'RMT', company: 'Royce Micro-Cap Trust' },
  'shearer robert': { ticker: 'KTB', company: 'Kontoor Brands' },
  'paravasthu mukund': { ticker: 'NVCR', company: 'NovoCure' }
};

/**
 * Resolve an executive name to its known ticker/company override, if any.
 * @param {string} name - Full executive name (case-insensitive).
 * @returns {{ticker:string, company:string}|null}
 */
function resolveExecutive(name) {
  if (!name) return null;
  return knownExecutives[name.toLowerCase().trim()] || null;
}

module.exports = {
  knownExecutives,
  resolveExecutive,
};
