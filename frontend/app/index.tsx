import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Titán V - Módulo de Construcción</Text>
      
      <Link href="/usuarios" style={styles.linkButton}>
        <Text style={styles.linkText}>Ir al CRUD de Usuarios</Text>
      </Link>

      <Link href="/giroscopio" style={[styles.linkButton, styles.linkSecundario]}>
        <Text style={styles.linkText}>Probar giroscopio y orientación</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f4f6f8',
    padding: 20 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 30, 
    color: '#333',
    textAlign: 'center'
  },
  linkButton: { 
    backgroundColor: '#007AFF', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  linkSecundario: {
    backgroundColor: '#495057',
    marginTop: 14
  },
  linkText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  }
});