/** Dati dello studio usati da checkout, email ed eventi. Solo dati reali. */
export const studio = {
  name: "Backrooms Studio",
  email: "backrooms.studios.vi@gmail.com",
  phone: "+39 324 891 1607",
  whatsapp: "393248911607",
  address: { street: "Via Galileo Galilei, 3", postalCode: "36057", city: "Arcugnano", province: "VI" },
  /** Chi incassa i pagamenti online (account Stripe) ed emette ricevute e fatture. */
  payee: { name: "Luca Cappellari", vatId: "04596940249" },
} as const;
