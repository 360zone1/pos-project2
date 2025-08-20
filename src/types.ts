export type Product = {
  id: number;
  name: string;
  price: string;
  stock: number; // Yeh line add karen
};

export type OrderItem = {
    id: number;
    name: string;
    price: number;
    quantity: number;
};