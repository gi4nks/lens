import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export const Prompt = ({ onSubmit }: { onSubmit: (text: string) => void }) => {
  const [input, setInput] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useInput((char: string, key: any) => {
    if (key.return) {
      onSubmit(input);
      setInput('');
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
    } else if (char) {
      setInput((prev) => prev + char);
    }
  });

  return (
    <Box>
      <Text color="blue">❯ </Text>
      <Text>{input}</Text>
      {/* Ghost text for AI autocomplete can go here later */}
    </Box>
  );
};
