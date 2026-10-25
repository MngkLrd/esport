#ifndef BRAVIA_HOME_CORE_H
#define BRAVIA_HOME_CORE_H
/* Portable TV-first state machine. No Sony SDK, firmware or system hooks. */
#define HOME_APP_COUNT 10
#define HOME_APP_COLUMNS 5
#define HOME_DOCK_COUNT 4

typedef enum { VIEW_TV=0, VIEW_HOME, VIEW_DETAIL } View;
typedef enum { AREA_TV_CARD=0, AREA_APPS, AREA_DOCK } Area;
typedef enum {
 K_LEFT=1,K_RIGHT,K_UP,K_DOWN,K_OK,K_BACK,K_HOME,
 K_VOL_UP,K_VOL_DOWN,K_MUTE,K_CH_UP,K_CH_DOWN,K_SOURCE,K_SETTINGS,
 K_OPTIONS,K_GUIDE,K_DIGIT,K_ANTENNA,K_TITLE_LIST,K_RECORD,K_POWER,
 K_AUDIO,K_SUBTITLE
} Key;
typedef enum {
 FX_NONE=0, FX_OPEN_APP, FX_TO_NATIVE_TV, FX_NATIVE_CHANNEL_LIST,
 FX_NATIVE_INPUTS, FX_NATIVE_SETTINGS, FX_PASS_TO_SYSTEM
} Effect;
/* Only the native host may report an installed/registered service as READY.
   READY does NOT mean its DRM playback was tested or even that launch succeeds. */
typedef enum { APP_UNKNOWN=0, APP_READY=1, APP_UNAVAILABLE=2 } AppAvailability;
typedef enum {
 FEEDBACK_NONE=0, FEEDBACK_NOT_REGISTERED,
 FEEDBACK_LAUNCH_FAILED, FEEDBACK_NO_HOST
} LaunchFeedback;
typedef struct {
 View view;
 Area area;
 int focus;
 int selected_app;
 AppAvailability availability[HOME_APP_COUNT];
 int last_dispatched_app;           /* Updated ONLY after host accepts dispatch; actual playback unconfirmed. */
 LaunchFeedback feedback;  /* Not claimed to be a real Sony error code. */
} HomeState;
typedef struct { Effect effect; int app_index; } HomeEvent;
void home_init(HomeState *s);
HomeEvent home_key(HomeState *s,Key key);
int home_set_app_availability(HomeState *s,int index,AppAvailability status);
AppAvailability home_get_app_availability(const HomeState *s,int index);
#endif
