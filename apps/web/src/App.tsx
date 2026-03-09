import { CssBaseline, Container, Typography } from '@mui/material';

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          Tedography
        </Typography>
        <Typography>
          Repo bootstrap successful.
        </Typography>
      </Container>
    </>
  );
}
