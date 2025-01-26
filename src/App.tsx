import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { AuthButton } from '@/components/ui/auth-button';
import { AuthGate } from '@/components/ui/auth-gate';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Send,
  Users,
  MapPin,
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Locate,
  Image,
  Tag,
  Activity,
  Calendar,
  Pencil,
  Trash2
} from 'lucide-react';
import { collection, doc, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Venue, ChatMessage, OnlineUser } from '@/types';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [24.7136, 46.6753];
const DEFAULT_ZOOM = 6;

function InitialLocation() {
  const map = useMap();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [hasSetInitialLocation, setHasSetInitialLocation] = useState(false);

  useEffect(() => {
    if (hasSetInitialLocation) return;

    let mounted = true;
    const locationHandler = {
      locationfound: (e: L.LocationEvent) => {
        if (!mounted) return;
        setHasSetInitialLocation(true);
        map.setView(e.latlng, 16);
      },
      locationerror: () => {
        if (!mounted) return;
        setHasSetInitialLocation(true);
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        toast({
          title: t('locationNotAvailable'),
          description: t('allowLocationAccess'),
          variant: "destructive",
        });
      }
    };

    map.on('locationfound', locationHandler.locationfound);
    map.on('locationerror', locationHandler.locationerror);
    
    map.locate({
      setView: true,
      maxZoom: 16,
      enableHighAccuracy: true
    });

    return () => {
      mounted = false;
      map.off('locationfound', locationHandler.locationfound);
      map.off('locationerror', locationHandler.locationerror);
    };
  }, [map, toast, t, hasSetInitialLocation]);

  return null;
}

function LocationControls({ onLocationPick }: { onLocationPick: (lat: number, lng: number) => void }) {
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const { t } = useTranslation();
  const { toast } = useToast();
  const map = useMapEvents({
    click(e) {
      if (isPickingLocation) {
        onLocationPick(e.latlng.lat, e.latlng.lng);
        setIsPickingLocation(false);
        map.getContainer().style.cursor = '';
      }
    },
    locationfound(e) {
      // Validate coordinates before using them
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      if (isFinite(lat) && isFinite(lng)) {
        setUserLocation([lat, lng]);
        map.flyTo([lat, lng], 16, {
          duration: 1.5
        });
      } else {
        toast({
          title: t('locationNotAvailable'),
          description: t('allowLocationAccess'),
          variant: "destructive",
        });
      }
    },
    locationerror() {
      toast({
        title: t('locationNotAvailable'),
        description: t('allowLocationAccess'),
        variant: "destructive",
      });
    },
  });

  const startLocationPick = () => {
    setIsPickingLocation(true);
    map.getContainer().style.cursor = 'crosshair';
  };

  const findMyLocation = () => {
    map.locate({
      setView: true,
      maxZoom: 16,
      enableHighAccuracy: true
    });
  };

  return (
    <>
      <div className="absolute top-4 left-4 z-[1000] flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isPickingLocation ? "secondary" : "default"}
                size="icon"
                onClick={startLocationPick}
                className="shadow-lg action-button"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t(isPickingLocation ? 'clickToPlace' : 'addLocation')}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                onClick={findMyLocation}
                className="shadow-lg action-button"
              >
                <Locate className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('findMyLocation')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {userLocation && isFinite(userLocation[0]) && isFinite(userLocation[1]) && (
        <Marker position={userLocation}>
          <Popup>
            <div className="p-2">
              <h3 className="font-semibold">{t('yourLocation')}</h3>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

function MapComponent({ venues, onVenueSelect, onLocationPick }: { 
  venues: Venue[],
  onVenueSelect: (venue: Venue) => void,
  onLocationPick: (lat: number, lng: number) => void
}) {
  const { t } = useTranslation();
  const map = useMap();

  useEffect(() => {
    if (venues.length > 0) {
      const bounds = venues.reduce(
        (bounds, venue) => bounds.extend([venue.coordinates.lat, venue.coordinates.lng]),
        map.getBounds()
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [venues, map]);

  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <InitialLocation />
      <LocationControls onLocationPick={onLocationPick} />
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          position={[venue.coordinates.lat, venue.coordinates.lng]}
          eventHandlers={{
            click: () => onVenueSelect(venue),
          }}
          className="map-marker"
        >
          <Popup className="venue-popup">
            <div className="p-2">
              <h3 className="font-semibold">{venue.name}</h3>
              <p className="text-sm text-muted-foreground">{venue.description.substring(0, 100)}...</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function App() {
  const { user } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [newVenueCoords, setNewVenueCoords] = useState<{lat: number, lng: number} | null>(null);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueDescription, setNewVenueDescription] = useState('');
  const [newVenueImageURL, setNewVenueImageURL] = useState('');
  const [newVenueEntryPrice, setNewVenueEntryPrice] = useState('');
  const [newVenueActivityType, setNewVenueActivityType] = useState('');
  const [newVenueActivities, setNewVenueActivities] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  useEffect(() => {
    const unsubVenues = onSnapshot(collection(db, 'venues'), (snapshot) => {
      const venueData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Venue[];
      setVenues(venueData);
    });

    return () => unsubVenues();
  }, []);

  useEffect(() => {
    if (!selectedVenue) return;

    const q = query(
      collection(db, `venues/${selectedVenue.id}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubMessages = onSnapshot(q, (snapshot) => {
      const messageData = snapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate() 
          : new Date();
        
        return {
          id: doc.id,
          ...data,
          timestamp
        };
      }) as ChatMessage[];
      setMessages(messageData);
    });

    return () => unsubMessages();
  }, [selectedVenue]);

  const handleLocationPick = (lat: number, lng: number) => {
    setNewVenueCoords({ lat, lng });
    setIsSidebarCollapsed(false);
    setNewVenueName('');
    setNewVenueDescription('');
    setNewVenueImageURL('');
    setNewVenueEntryPrice('');
    setNewVenueActivityType('');
    setNewVenueActivities('');
    setIsEditing(false);
  };

  const handleEditVenue = (venue: Venue) => {
    setNewVenueCoords(venue.coordinates);
    setNewVenueName(venue.name);
    setNewVenueDescription(venue.description);
    setNewVenueImageURL(venue.imageURL);
    setNewVenueEntryPrice(venue.entryPrice.toString());
    setNewVenueActivityType(venue.activityType);
    setNewVenueActivities(venue.activities.join(', '));
    setIsEditing(true);
    setSelectedVenue(venue);
  };

  const handleDeleteVenue = async (venue: Venue) => {
    try {
      await deleteDoc(doc(db, 'venues', venue.id));
      setSelectedVenue(null);
      toast({
        title: t('success'),
        description: t('locationDeleted'),
      });
    } catch (error) {
      console.error('Error deleting venue:', error);
      toast({
        title: t('error'),
        description: t('errorDeletingLocation'),
        variant: "destructive",
      });
    }
  };

  const saveVenue = async () => {
    if (!newVenueCoords || !newVenueName.trim() || !newVenueDescription.trim()) {
      toast({
        title: t('validationError'),
        description: t('fillAllFields'),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const venueData = {
        name: newVenueName.trim(),
        description: newVenueDescription.trim(),
        coordinates: newVenueCoords,
        imageURL: newVenueImageURL || `https://source.unsplash.com/800x600/?place,${encodeURIComponent(newVenueName)}`,
        entryPrice: parseFloat(newVenueEntryPrice) || 0,
        activityType: newVenueActivityType.trim(),
        activities: newVenueActivities.split(',').map(a => a.trim()).filter(Boolean),
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'anonymous',
      };

      if (isEditing && selectedVenue) {
        const venueRef = doc(db, 'venues', selectedVenue.id);
        await updateDoc(venueRef, venueData);
        toast({
          title: t('success'),
          description: t('locationUpdated'),
        });
      } else {
        const docRef = await addDoc(collection(db, 'venues'), venueData);
        setSelectedVenue({ id: docRef.id, ...venueData });
        toast({
          title: t('success'),
          description: t('locationSaved'),
        });
      }

      setNewVenueCoords(null);
      setNewVenueName('');
      setNewVenueDescription('');
      setNewVenueImageURL('');
      setNewVenueEntryPrice('');
      setNewVenueActivityType('');
      setNewVenueActivities('');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving venue:', error);
      toast({
        title: t('error'),
        description: isEditing ? t('errorUpdatingLocation') : t('errorSavingLocation'),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedVenue || !newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, `venues/${selectedVenue.id}/messages`), {
        locationId: selectedVenue.id,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        message: newMessage.trim(),
        timestamp: serverTimestamp()
      });

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: t('error'),
        description: 'Error sending message',
        variant: "destructive",
      });
    }
  };

  return (
    <AuthGate>
      <TooltipProvider>
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="app-container">
          <div className="absolute top-4 right-4 z-[1000] flex items-center gap-4">
            <LanguageSwitcher />
            <AuthButton />
          </div>
          
          <div className={`map-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="h-full p-4">
              <Card className="h-full overflow-hidden shadow-xl">
                <MapContainer
                  center={DEFAULT_CENTER}
                  zoom={DEFAULT_ZOOM}
                  className="h-full"
                >
                  <MapComponent 
                    venues={venues} 
                    onVenueSelect={setSelectedVenue}
                    onLocationPick={handleLocationPick}
                  />
                </MapContainer>
              </Card>
            </div>
          </div>

          <div className={`sidebar ${!isSidebarCollapsed ? 'open' : ''}`}>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="sidebar-collapse-button"
              aria-label={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            >
              {isSidebarCollapsed 
                ? i18n.language === 'ar' ? <ChevronLeft /> : <ChevronRight />
                : i18n.language === 'ar' ? <ChevronRight /> : <ChevronLeft />
              }
            </button>

            <div className="h-full flex flex-col">
              <div className="p-4 flex-shrink-0">
                {newVenueCoords ? (
                  <div className="venue-form">
                    <h2 className="text-2xl font-bold mb-6">
                      {isEditing ? t('editLocation') : t('addLocation')}
                    </h2>
                    <div className="space-y-4">
                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <MapPin className="h-4 w-4" />
                          {t('coordinates')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-sm text-muted-foreground">{t('latitude')}</span>
                            <Input value={newVenueCoords.lat.toFixed(6)} readOnly className="venue-form-input" />
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">{t('longitude')}</span>
                            <Input value={newVenueCoords.lng.toFixed(6)} readOnly className="venue-form-input" />
                          </div>
                        </div>
                      </div>

                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <Tag className="h-4 w-4" />
                          {t('name')}
                        </label>
                        <Input 
                          className="venue-form-input"
                          placeholder={t('enterVenueName')}
                          value={newVenueName}
                          onChange={(e) => setNewVenueName(e.target.value)}
                        />
                      </div>

                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <MessageSquare className="h-4 w-4" />
                          {t('description')}
                        </label>
                        <Input 
                          className="venue-form-input"
                          placeholder={t('enterVenueDescription')}
                          value={newVenueDescription}
                          onChange={(e) => setNewVenueDescription(e.target.value)}
                        />
                      </div>

                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <Image className="h-4 w-4" />
                          {t('imageURL')}
                        </label>
                        <Input 
                          className="venue-form-input"
                          placeholder={t('enterImageURL')}
                          value={newVenueImageURL}
                          onChange={(e) => setNewVenueImageURL(e.target.value)}
                        />
                      </div>

                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <Tag className="h-4 w-4" />
                          {t('entryPrice')}
                        </label>
                        <div className="relative">
                          <Input 
                            className="venue-form-input pr-16"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={t('enterEntryPrice')}
                            value={newVenueEntryPrice}
                            onChange={(e) => setNewVenueEntryPrice(e.target.value)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {t('sar')}
                          </span>
                        </div>
                      </div>

                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <Activity className="h-4 w-4" />
                          {t('activityType')}
                        </label>
                        <Input 
                          className="venue-form-input"
                          placeholder={t('enterActivityType')}
                          value={newVenueActivityType}
                          onChange={(e) => setNewVenueActivityType(e.target.value)}
                        />
                      </div>

                      <div className="venue-form-field">
                        <label className="venue-form-label">
                          <Calendar className="h-4 w-4" />
                          {t('activities')}
                        </label>
                        <Input 
                          className="venue-form-input"
                          placeholder={t('enterActivities')}
                          value={newVenueActivities}
                          onChange={(e) => setNewVenueActivities(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1" 
                          variant="outline"
                          onClick={() => {
                            setNewVenueCoords(null);
                            setNewVenueName('');
                            setNewVenueDescription('');
                            setNewVenueImageURL('');
                            setNewVenueEntryPrice('');
                            setNewVenueActivityType('');
                            setNewVenueActivities('');
                            setIsEditing(false);
                          }}
                        >
                          {t('cancel')}
                        </Button>
                        <Button 
                          className="flex-1" 
                          variant="default"
                          onClick={saveVenue}
                          disabled={isSaving || !newVenueName.trim() || !newVenueDescription.trim()}
                        >
                          {isSaving 
                            ? isEditing ? t('updating') : t('saving')
                            : isEditing ? t('editLocation') : t('saveLocation')
                          }
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : selectedVenue ? (
                  <div className="space-y-4">
                    <div className="aspect-video rounded-lg overflow-hidden shadow-lg">
                      <img
                        src={selectedVenue.imageURL}
                        alt={selectedVenue.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">{selectedVenue.name}</h2>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditVenue(selectedVenue)}
                            className="action-button"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => setIsDeleting(true)}
                            className="action-button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary">
                          <MapPin className="w-3 h-3 mr-1" />
                          {t('venue')}
                        </Badge>
                        {selectedVenue.entryPrice > 0 && (
                          <Badge variant="secondary">
                            <Tag className="w-3 h-3 mr-1" />
                            {selectedVenue.entryPrice} {t('sar')}
                          </Badge>
                        )}
                        {selectedVenue.activityType && (
                          <Badge variant="secondary">
                            <Activity className="w-3 h-3 mr-1" />
                            {selectedVenue.activityType}
                          </Badge>
                        )}
                        <Badge variant="secondary">
                          <Users className="w-3 h-3 mr-1" />
                          {onlineUsers.length} {t('online')}
                        </Badge>
                      </div>
                      <p className="mt-4 text-muted-foreground">
                        {selectedVenue.description}
                      </p>
                      {selectedVenue.activities?.length > 0 && (
                        <div className="mt-4">
                          <h3 className="font-semibold mb-2">{t('activities')}</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedVenue.activities.map((activity, index) => (
                              <Badge key={index} variant="outline">
                                {activity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground">
                    {t('selectOrAdd')}
                  </div>
                )}
              </div>

              <Separator />

              {selectedVenue && (
                <div className="flex-1 flex flex-col p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      {t('chat')}
                    </h3>
                  </div>

                  <ScrollArea className="flex-1 pr-4 custom-scrollbar">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`message-bubble ${
                            message.userId === user?.uid ? 'sent' : 'received'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {message.userDisplayName}
                            </span>
                            <span className="text-xs opacity-70">
                              {format(message.timestamp, 'HH:mm')}
                            </span>
                          </div>
                          <p>{message.message}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="mt-4">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t('typeMessage')}
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button onClick={sendMessage} size="icon" className="shrink-0 action-button">
                            <Send className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('sendMessage')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteLocation')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteConfirmation')}
                  <br />
                  {t('deleteWarning')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (selectedVenue) {
                      handleDeleteVenue(selectedVenue);
                    }
                    setIsDeleting(false);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('confirmDelete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TooltipProvider>
    </AuthGate>
  );
}

export default App;