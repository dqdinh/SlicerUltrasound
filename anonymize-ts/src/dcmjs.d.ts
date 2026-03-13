declare module 'dcmjs' {
  const dcmjs: {
    data: {
      DicomMessage: {
        readFile(buffer: ArrayBuffer): any;
        [key: string]: any;
      };
      DicomDict: new (meta: any) => {
        meta: any;
        dict: any;
        write(): ArrayBuffer;
        [key: string]: any;
      };
      DicomMetaDictionary: {
        naturalizeDataset(dataset: any): Record<string, any>;
        denaturalizeDataset(dataset: any): any;
        uid(): string;
        [key: string]: any;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
  export default dcmjs;
}
