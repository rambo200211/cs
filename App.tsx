import './global.css';
import {StatusBar,Text} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Home from './src/Home';
import History from './src/History';
import Charts from './src/Charts';
import Loans from './src/Loans';
import Add from './src/Add';
import Transaction from './src/Transaction';
import type {Routes} from './src/model';

const Stack = createNativeStackNavigator<Routes>();
const Tabs = createBottomTabNavigator<{Home:undefined;History:undefined;Charts:undefined;Loans:undefined}>();
function Main() {
  return <Tabs.Navigator screenOptions={({route})=>({
    tabBarActiveTintColor:'#115e59',
    tabBarIcon:({color})=><Text style={{color,fontSize:23}}>
      {route.name==='Home'?'⌂':route.name==='Loans'?'↔':'◷'}
    </Text>,
    headerShadowVisible:false
  })}>
    <Tabs.Screen name="Home" component={Home} options={{title:'Pocket Ledger',tabBarLabel:'Home'}}/>
    <Tabs.Screen name="History" component={History} options={{title:'Monthly history',tabBarLabel:'History'}}/>
    <Tabs.Screen name="Charts" component={Charts} options={{
      title:'Income and expenses',
      tabBarLabel:'Charts',
      tabBarIcon:({color})=><Text style={{color,fontSize:23}}>↗</Text>
    }}/>
    <Tabs.Screen name="Loans" component={Loans} options={{title:'Loans',tabBarLabel:'Loans'}}/>
  </Tabs.Navigator>;
}
export default function App() {
  return <SafeAreaProvider><StatusBar barStyle="dark-content"/><NavigationContainer>
    <Stack.Navigator><Stack.Screen name="Main" component={Main} options={{headerShown:false}}/>
      <Stack.Screen name="Transaction" component={Transaction} options={{title:'Transaction details'}}/><Stack.Screen name="Add" component={Add} options={({route})=>({presentation:'modal',title:route.params?.entry ? 'Edit transaction' : 'Add transaction'})}/>
    </Stack.Navigator>
  </NavigationContainer></SafeAreaProvider>;
}
