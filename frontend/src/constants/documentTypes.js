export const DOCUMENT_TYPE_OPTIONS = [
  {
    value: 'AADHAAR_CARD',
    label: 'Aadhaar Card',
    category: 'IDENTITY',
    defaultTitle: 'Aadhaar Card',
    description: 'Government issued Aadhaar identification card',
  },
  {
    value: 'PAN_CARD',
    label: 'PAN Card',
    category: 'IDENTITY',
    defaultTitle: 'PAN Card',
    description: 'Income Tax Department PAN Card',
  },
  {
    value: '10TH_MARKSHEET',
    label: '10th Marksheet',
    category: 'EDUCATION',
    defaultTitle: '10th Marksheet',
    description: 'Secondary School (10th) marksheet or certificate',
  },
  {
    value: '12TH_MARKSHEET',
    label: '12th Marksheet',
    category: 'EDUCATION',
    defaultTitle: '12th Marksheet',
    description: 'Higher Secondary (12th) marksheet or certificate',
  },
  {
    value: 'GRADUATION',
    label: 'Graduation Degree / Marksheet',
    category: 'EDUCATION',
    defaultTitle: 'Graduation Degree / Marksheet',
    description: 'Bachelor degree certificate, provisional degree, or final marksheet',
  },
  {
    value: 'VOTER_PASSPORT',
    label: 'Voter Card / Passport (Optional)',
    category: 'IDENTITY',
    defaultTitle: 'Voter Card / Passport',
    description: 'If you have a voter card or passport for identity verification',
  },
  {
    value: 'RENT_AGREEMENT',
    label: 'Rent Agreement (If living on rent)',
    category: 'ADDRESS',
    defaultTitle: 'Rent Agreement',
    description: 'Valid rent agreement if currently living on rent',
  },
  {
    value: 'ELECTRICITY_BILL',
    label: 'Electricity Bill (Own place)',
    category: 'ADDRESS',
    defaultTitle: 'Electricity Bill (Own Place)',
    description: 'Recent electricity utility bill if living in own residence',
  },
  {
    value: 'EXPERIENCE',
    label: 'Past Experience & Relieving Letters',
    category: 'EXPERIENCE',
    defaultTitle: 'Experience Letter',
    description: 'Relieving letter or experience certificate from previous employer',
  },
  {
    value: 'OFFER',
    label: 'Offer Letter & Contract',
    category: 'OFFER',
    defaultTitle: 'Offer Letter',
    description: 'Signed offer letter or employment contract',
  },
  {
    value: 'OTHER',
    label: 'Other Document',
    category: 'OTHER',
    defaultTitle: '',
    description: 'Any other relevant document or certificate',
  },
];

export const DOCUMENT_TYPE_MAP = DOCUMENT_TYPE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

export const getDocumentLabel = (typeOrCategory) => {
  if (!typeOrCategory) return 'Document';
  if (DOCUMENT_TYPE_MAP[typeOrCategory]) {
    return DOCUMENT_TYPE_MAP[typeOrCategory].label;
  }
  const fallbackMap = {
    IDENTITY: 'ID Proof',
    EDUCATION: 'Education',
    ADDRESS: 'Address Proof',
    EXPERIENCE: 'Experience',
    OFFER: 'Offer Letter',
    TAX: 'Tax Document',
    MEDICAL: 'Medical Certificate',
    OTHER: 'Other Document',
    AADHAAR: 'Aadhaar Card',
    PAN: 'PAN Card',
    PASSPORT: 'Passport',
    CERTIFICATE: 'Certificate',
  };
  return fallbackMap[typeOrCategory] || typeOrCategory.replace(/_/g, ' ');
};
