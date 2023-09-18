declare module 'native-dns-packet' {

  export interface Packet {
    header: {
      id: number,
      qr: number,
      opcode: number,
      aa: number,
      tc: number,
      rd: number,
      ra: number,
      res1: number,
      res2: number,
      res3: number,
      rcode: number,
    };
    answer: Array<{
      name: string,
      type: number,
      class: number,
      ttl: number,
      address?: string,
      data?: string,
    }>;
    question: Array<{
      name: string,
      type: string,
    }>;
  }

  export function parse(response: Buffer): Packet;
  export function write(buff: Buffer, packet: Packet): number;
}
